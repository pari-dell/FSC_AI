class CommodityManager {
    constructor() {
        this.commodities = JSON.parse(localStorage.getItem('commodities')) || [];
        this.rules = JSON.parse(localStorage.getItem('rules')) || this.getDefaultRules();
        this.currentEditId = null;
        this.currentEditRuleId = null;
        this.currentRole = 'pilot';
        this.init();
    }

    getDefaultRules() {
        return [
            {
                id: 1,
                name: 'DSI Threshold Rule',
                trigger: 'Proj. DSI < 30% Target DSI from ILTS',
                decision: 'repoint_orders',
                businessProcess: 'Move customer backlog order from one FC to another',
                writebackTool: 'OFS',
                description: 'Triggered when projected days of supply inventory falls below 30% of target'
            },
            {
                id: 2,
                name: 'Shipment Redirection Rule',
                trigger: 'Port congestion detected',
                decision: 'redirect_shipments',
                businessProcess: 'Change destination FC of ocean shipment once it reaches port',
                writebackTool: 'TIP',
                description: 'Redirect shipments when port congestion causes delays'
            },
            {
                id: 3,
                name: 'Expedite Shipment Rule',
                trigger: 'Urgent customer requirement',
                decision: 'expedite_fb_tt',
                businessProcess: 'Use faster shipment modes to reduce transport lead time',
                writebackTool: 'MMR - DISCP',
                description: 'Expedite shipments using faster transport modes for urgent needs'
            },
            {
                id: 4,
                name: 'Inventory Rebalancing Rule',
                trigger: 'Inventory imbalance across FCs',
                decision: 'rebalance_inventory',
                businessProcess: 'Move stored physical inventory from one FC to another',
                writebackTool: 'MMR - DISCP, G/T',
                description: 'Rebalance inventory when distribution centers have imbalance'
            },
            {
                id: 5,
                name: 'Supplier Commit Modification Rule',
                trigger: 'Supplier capacity constraints',
                decision: 'modify_commits',
                businessProcess: 'Modify timeline, quantity, destination of supplier commit before shipment',
                writebackTool: 'Email to supplier',
                description: 'Modify supplier commitments when capacity constraints are identified'
            }
        ];
    }

    init() {
        this.bindEvents();
        this.updateRoleView();
        this.renderCommodities();
        this.renderRules();
    }

    bindEvents() {
        document.getElementById('roleSelector').addEventListener('change', (e) => this.switchRole(e));
        document.getElementById('commodityForm').addEventListener('submit', (e) => this.addCommodity(e));
        document.getElementById('editForm').addEventListener('submit', (e) => this.updateCommodity(e));
        document.getElementById('ruleForm').addEventListener('submit', (e) => this.saveRule(e));
        document.getElementById('searchInput').addEventListener('input', (e) => this.filterCommodities(e));
        document.getElementById('filterStatus').addEventListener('change', (e) => this.filterCommodities(e));
        document.getElementById('filterDecision').addEventListener('change', (e) => this.filterCommodities(e));
        document.getElementById('filterMemoryLayer').addEventListener('change', (e) => this.filterCommodities(e));
        
        const modal = document.getElementById('modal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        const ruleModal = document.getElementById('ruleModal');
        const closeRuleBtn = document.querySelector('.close-rule');
        
        closeRuleBtn.addEventListener('click', () => this.closeRuleModal());
        ruleModal.addEventListener('click', (e) => {
            if (e.target === ruleModal) this.closeRuleModal();
        });
    }

    switchRole(e) {
        this.currentRole = e.target.value;
        this.updateRoleView();
        this.showNotification(`Switched to ${this.currentRole} role`, 'info');
    }

    updateRoleView() {
        const adminPanel = document.getElementById('adminPanel');
        const pilotPanel = document.getElementById('pilotPanel');
        
        if (this.currentRole === 'admin') {
            adminPanel.classList.remove('hidden');
            pilotPanel.classList.add('hidden');
        } else {
            adminPanel.classList.add('hidden');
            pilotPanel.classList.remove('hidden');
        }
    }

    addCommodity(e) {
        e.preventDefault();
        
        const commodityId = document.getElementById('commodityId').value.trim();
        const commodityName = document.getElementById('commodityName').value.trim();
        const quantity = parseInt(document.getElementById('quantity').value);
        const kpiTrigger = document.getElementById('kpiTrigger').value;
        const grain = document.getElementById('grain').value;
        const decision = document.getElementById('decision').value;
        const userDecision = document.getElementById('userDecision').value;
        const userNotes = document.getElementById('userNotes').value.trim();
        const tagsInput = document.getElementById('tags').value.trim();
        const memoryLayer = document.getElementById('memoryLayer').value || 'short_term';
        
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        const commodity = {
            id: Date.now(),
            commodityId,
            commodityName,
            quantity,
            kpiTrigger,
            grain,
            recommendedDecision: decision,
            userDecision,
            userNotes,
            tags,
            memoryLayer,
            accessCount: 0,
            lastAccessed: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.commodities.unshift(commodity);
        this.saveCommoditiesToStorage();
        this.renderCommodities();
        this.resetForm();
        
        this.showNotification('Commodity decision submitted successfully!', 'success');
    }

    updateCommodity(e) {
        e.preventDefault();
        
        const commodityName = document.getElementById('editCommodityName').value.trim();
        const quantity = parseInt(document.getElementById('editQuantity').value);
        const userDecision = document.getElementById('editUserDecision').value;
        const userNotes = document.getElementById('editUserNotes').value.trim();
        
        const commodityIndex = this.commodities.findIndex(c => c.id === this.currentEditId);
        
        if (commodityIndex !== -1) {
            this.commodities[commodityIndex] = {
                ...this.commodities[commodityIndex],
                commodityName,
                quantity,
                userDecision,
                userNotes,
                updatedAt: new Date().toISOString()
            };
            
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.closeModal();
            this.showNotification('Commodity decision updated successfully!', 'success');
        }
    }

    deleteCommodity(id) {
        if (confirm('Are you sure you want to delete this commodity decision?')) {
            this.commodities = this.commodities.filter(c => c.id !== id);
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.showNotification('Commodity decision deleted successfully!', 'success');
        }
    }

    editCommodity(id) {
        const commodity = this.commodities.find(c => c.id === id);
        
        if (commodity) {
            this.currentEditId = id;
            document.getElementById('editCommodityName').value = commodity.commodityName;
            document.getElementById('editQuantity').value = commodity.quantity;
            document.getElementById('editUserDecision').value = commodity.userDecision;
            document.getElementById('editUserNotes').value = commodity.userNotes;
            
            document.getElementById('modal').classList.add('show');
        }
    }

    closeModal() {
        document.getElementById('modal').classList.remove('show');
        this.currentEditId = null;
        document.getElementById('editForm').reset();
    }

    filterCommodities() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const statusFilter = document.getElementById('filterStatus').value;
        const decisionFilter = document.getElementById('filterDecision').value;
        const memoryLayerFilter = document.getElementById('filterMemoryLayer').value;
        
        let filtered = this.commodities;
        
        if (searchTerm) {
            filtered = filtered.filter(commodity => 
                commodity.commodityId.toLowerCase().includes(searchTerm) ||
                commodity.commodityName.toLowerCase().includes(searchTerm) ||
                commodity.userNotes.toLowerCase().includes(searchTerm) ||
                commodity.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(commodity => commodity.userDecision === statusFilter);
        }
        
        if (decisionFilter !== 'all') {
            filtered = filtered.filter(commodity => commodity.recommendedDecision === decisionFilter);
        }
        
        if (memoryLayerFilter !== 'all') {
            filtered = filtered.filter(commodity => commodity.memoryLayer === memoryLayerFilter);
        }
        
        this.renderCommodities(filtered);
    }

    renderCommodities(commoditiesToRender = this.commodities) {
        const container = document.getElementById('commoditiesList');
        const countElement = document.getElementById('commodityCount');
        
        countElement.textContent = `${commoditiesToRender.length} commodities`;
        this.updateMemoryStats();
        
        if (commoditiesToRender.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <p>No commodity decisions found. ${this.commodities.length === 0 ? 'Start by submitting your first decision!' : 'Try adjusting your search or filters.'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = commoditiesToRender.map(commodity => `
            <div class="commodity-card">
                <div class="commodity-card-header">
                    <div>
                        <div class="commodity-card-id">${this.escapeHtml(commodity.commodityId)}</div>
                        <h3 class="commodity-card-name">${this.escapeHtml(commodity.commodityName)}</h3>
                    </div>
                    <div class="commodity-card-badges">
                        <span class="commodity-card-status ${commodity.userDecision}">${this.getStatusLabel(commodity.userDecision)}</span>
                        <span class="commodity-card-memory-layer ${commodity.memoryLayer}">${this.getMemoryLayerLabel(commodity.memoryLayer)}</span>
                    </div>
                </div>
                <div class="commodity-card-body">
                    <div class="commodity-card-field">
                        <div class="commodity-card-field-label">Quantity</div>
                        <div class="commodity-card-field-value">${commodity.quantity.toLocaleString()}</div>
                    </div>
                    <div class="commodity-card-field">
                        <div class="commodity-card-field-label">KPI Trigger</div>
                        <div class="commodity-card-field-value">${this.getKPITriggerLabel(commodity.kpiTrigger)}</div>
                    </div>
                    <div class="commodity-card-field">
                        <div class="commodity-card-field-label">Grain</div>
                        <div class="commodity-card-field-value">${commodity.grain}</div>
                    </div>
                    <div class="commodity-card-field">
                        <div class="commodity-card-field-label">Recommended Decision</div>
                        <div class="commodity-card-field-value">${this.getDecisionLabel(commodity.recommendedDecision)}</div>
                    </div>
                </div>
                <div class="commodity-card-notes">
                    <div class="commodity-card-notes-label">User Notes (Reason for Decision)</div>
                    <div class="commodity-card-notes-content">${this.escapeHtml(commodity.userNotes)}</div>
                </div>
                ${commodity.tags.length > 0 ? `
                    <div class="commodity-card-tags">
                        ${commodity.tags.map(tag => `<span class="tag">#${this.escapeHtml(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="commodity-card-footer">
                    <div class="commodity-card-meta">
                        <span class="commodity-card-date">${this.formatDate(commodity.updatedAt)}</span>
                        <span class="commodity-card-access-count">Accessed: ${commodity.accessCount || 0} times</span>
                    </div>
                    <div class="commodity-card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="commodityManager.accessCommodity(${commodity.id})">👁️ View</button>
                        <button class="btn btn-secondary btn-sm" onclick="commodityManager.editCommodity(${commodity.id})">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="commodityManager.deleteCommodity(${commodity.id})">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderRules() {
        const container = document.getElementById('rulesList');
        
        if (this.rules.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚙️</div>
                    <p>No rules defined yet. Add your first rule!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.rules.map(rule => `
            <div class="rule-card">
                <div class="rule-card-header">
                    <h3 class="rule-card-name">${this.escapeHtml(rule.name)}</h3>
                    <span class="rule-card-trigger">${this.escapeHtml(rule.trigger)}</span>
                </div>
                <div class="rule-card-body">
                    <div class="rule-card-field">
                        <div class="rule-card-label">Decision</div>
                        <div class="rule-card-value">${this.getDecisionLabel(rule.decision)}</div>
                    </div>
                    <div class="rule-card-field">
                        <div class="rule-card-label">Business Process</div>
                        <div class="rule-card-value">${this.escapeHtml(rule.businessProcess)}</div>
                    </div>
                    <div class="rule-card-field">
                        <div class="rule-card-label">Writeback Tool</div>
                        <div class="rule-card-value">${this.escapeHtml(rule.writebackTool)}</div>
                    </div>
                    ${rule.description ? `
                        <div class="rule-card-field">
                            <div class="rule-card-label">Description</div>
                            <div class="rule-card-value">${this.escapeHtml(rule.description)}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="rule-card-footer">
                    <span class="rule-card-date">Rule ID: ${rule.id}</span>
                    <div class="rule-card-actions">
                        <button class="btn btn-secondary btn-sm" onclick="commodityManager.editRule(${rule.id})">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="commodityManager.deleteRule(${rule.id})">🗑️ Delete</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    saveRule(e) {
        e.preventDefault();
        
        const name = document.getElementById('ruleName').value.trim();
        const trigger = document.getElementById('ruleTrigger').value.trim();
        const decision = document.getElementById('ruleDecision').value;
        const businessProcess = document.getElementById('ruleBusinessProcess').value.trim();
        const writebackTool = document.getElementById('ruleWritebackTool').value.trim();
        const description = document.getElementById('ruleDescription').value.trim();
        
        if (this.currentEditRuleId) {
            const ruleIndex = this.rules.findIndex(r => r.id === this.currentEditRuleId);
            if (ruleIndex !== -1) {
                this.rules[ruleIndex] = {
                    ...this.rules[ruleIndex],
                    name,
                    trigger,
                    decision,
                    businessProcess,
                    writebackTool,
                    description
                };
                this.showNotification('Rule updated successfully!', 'success');
            }
        } else {
            const rule = {
                id: Date.now(),
                name,
                trigger,
                decision,
                businessProcess,
                writebackTool,
                description
            };
            this.rules.push(rule);
            this.showNotification('Rule added successfully!', 'success');
        }
        
        this.saveRulesToStorage();
        this.renderRules();
        this.closeRuleModal();
    }

    editRule(id) {
        const rule = this.rules.find(r => r.id === id);
        
        if (rule) {
            this.currentEditRuleId = id;
            document.getElementById('ruleModalTitle').textContent = 'Edit Rule';
            document.getElementById('ruleName').value = rule.name;
            document.getElementById('ruleTrigger').value = rule.trigger;
            document.getElementById('ruleDecision').value = rule.decision;
            document.getElementById('ruleBusinessProcess').value = rule.businessProcess;
            document.getElementById('ruleWritebackTool').value = rule.writebackTool;
            document.getElementById('ruleDescription').value = rule.description || '';
            
            document.getElementById('ruleModal').classList.add('show');
        }
    }

    deleteRule(id) {
        if (confirm('Are you sure you want to delete this rule?')) {
            this.rules = this.rules.filter(r => r.id !== id);
            this.saveRulesToStorage();
            this.renderRules();
            this.showNotification('Rule deleted successfully!', 'success');
        }
    }

    closeRuleModal() {
        document.getElementById('ruleModal').classList.remove('show');
        this.currentEditRuleId = null;
        document.getElementById('ruleForm').reset();
        document.getElementById('ruleModalTitle').textContent = 'Add New Rule';
    }

    saveCommoditiesToStorage() {
        localStorage.setItem('commodities', JSON.stringify(this.commodities));
    }

    saveRulesToStorage() {
        localStorage.setItem('rules', JSON.stringify(this.rules));
    }

    resetForm() {
        document.getElementById('commodityForm').reset();
    }

    getStatusLabel(status) {
        const labels = {
            'accepted': '✅ Accepted',
            'rejected': '❌ Rejected',
            'modified': '🔄 Modified'
        };
        return labels[status] || status;
    }

    getKPITriggerLabel(trigger) {
        const labels = {
            'dsi_threshold': 'Proj. DSI < 30% Target DSI from ILTS',
            'stockout_risk': 'Stockout Risk > Threshold',
            'excess_inventory': 'Excess Inventory > Target',
            'lead_time': 'Lead Time Deviation > 20%'
        };
        return labels[trigger] || trigger;
    }

    getDecisionLabel(decision) {
        const labels = {
            'repoint_orders': 'Repoint Orders',
            'redirect_shipments': 'Redirect Shipments',
            'expedite_fb_tt': 'Expedite by FB / TT',
            'rebalance_inventory': 'Rebalance Inventory',
            'modify_commits': 'Modify Commits'
        };
        return labels[decision] || decision;
    }

    getMemoryLayerLabel(layer) {
        const labels = {
            'short_term': '🧠 Short-term',
            'mid_term': '🔄 Mid-term',
            'long_term': '💾 Long-term'
        };
        return labels[layer] || layer;
    }

    updateMemoryStats() {
        const shortTermCount = this.commodities.filter(c => c.memoryLayer === 'short_term').length;
        const midTermCount = this.commodities.filter(c => c.memoryLayer === 'mid_term').length;
        const longTermCount = this.commodities.filter(c => c.memoryLayer === 'long_term').length;

        document.getElementById('shortTermCount').textContent = shortTermCount;
        document.getElementById('midTermCount').textContent = midTermCount;
        document.getElementById('longTermCount').textContent = longTermCount;
    }

    accessCommodity(id) {
        const commodity = this.commodities.find(c => c.id === id);
        if (commodity) {
            commodity.accessCount = (commodity.accessCount || 0) + 1;
            commodity.lastAccessed = new Date().toISOString();
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.showNotification(`Commodity accessed. Total accesses: ${commodity.accessCount}`, 'info');
        }
    }

    promoteMemories() {
        let promotedCount = 0;
        
        // Promote frequently accessed short-term memories to mid-term
        this.commodities.forEach(commodity => {
            if (commodity.memoryLayer === 'short_term' && commodity.accessCount >= 3) {
                commodity.memoryLayer = 'mid_term';
                commodity.accessCount = 0;
                promotedCount++;
            }
        });

        // Promote frequently accessed mid-term memories to long-term
        this.commodities.forEach(commodity => {
            if (commodity.memoryLayer === 'mid_term' && commodity.accessCount >= 5) {
                commodity.memoryLayer = 'long_term';
                commodity.accessCount = 0;
                promotedCount++;
            }
        });

        if (promotedCount > 0) {
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.showNotification(`${promedCount} memories promoted to higher layers`, 'success');
        } else {
            this.showNotification('No memories eligible for promotion', 'info');
        }
    }

    consolidateMemories() {
        let consolidatedCount = 0;
        
        // Consolidate short-term memories to mid-term based on age (older than 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        this.commodities.forEach(commodity => {
            if (commodity.memoryLayer === 'short_term') {
                const createdAt = new Date(commodity.createdAt);
                if (createdAt < sevenDaysAgo) {
                    commodity.memoryLayer = 'mid_term';
                    consolidatedCount++;
                }
            }
        });

        // Consolidate mid-term memories to long-term based on age (older than 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        this.commodities.forEach(commodity => {
            if (commodity.memoryLayer === 'mid_term') {
                const createdAt = new Date(commodity.createdAt);
                if (createdAt < thirtyDaysAgo) {
                    commodity.memoryLayer = 'long_term';
                    consolidatedCount++;
                }
            }
        });

        if (consolidatedCount > 0) {
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.showNotification(`${consolidatedCount} memories consolidated to higher layers`, 'success');
        } else {
            this.showNotification('No memories eligible for consolidation', 'info');
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px 24px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            font-weight: 600;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

const commodityManager = new CommodityManager();

function openRuleModal() {
    document.getElementById('ruleModal').classList.add('show');
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
