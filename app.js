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
        document.getElementById('filterRecommendationType').addEventListener('change', (e) => this.filterCommodities(e));
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
        
        const sourceTable = document.getElementById('sourceTable').value.trim();
        const recommendationType = document.getElementById('recommendationType').value;
        const actionDate = document.getElementById('actionDate').value.trim();
        const actionTaken = document.getElementById('actionTaken').value;
        const comment = document.getElementById('comment').value.trim();
        const userNotes = document.getElementById('userNotes').value.trim();
        const tagsInput = document.getElementById('tags').value.trim();
        const memoryLayer = document.getElementById('memoryLayer').value || 'short_term';
        const memoryType = document.getElementById('memoryType').value || 'episodic';
        
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        const commodity = {
            id: Date.now(),
            sourceTable,
            recommendationType,
            actionDate,
            actionTaken,
            comment,
            userDecision: actionTaken,
            userNotes,
            tags,
            memoryLayer,
            memoryType,
            accessCount: 0,
            lastAccessed: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.commodities.unshift(commodity);
        this.saveCommoditiesToStorage();
        this.renderCommodities();
        this.resetForm();
        
        this.showNotification('SDO recommendation submitted successfully!', 'success');
    }

    updateCommodity(e) {
        e.preventDefault();
        
        const sourceTable = document.getElementById('editSourceTable').value.trim();
        const recommendationType = document.getElementById('editRecommendationType').value;
        const actionDate = document.getElementById('editActionDate').value.trim();
        const actionTaken = document.getElementById('editActionTaken').value;
        const comment = document.getElementById('editComment').value.trim();
        const userNotes = document.getElementById('editUserNotes').value.trim();
        const tagsInput = document.getElementById('editTags').value.trim();
        const memoryType = document.getElementById('editMemoryType').value;
        
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        const commodityIndex = this.commodities.findIndex(c => c.id === this.currentEditId);
        
        if (commodityIndex !== -1) {
            this.commodities[commodityIndex] = {
                ...this.commodities[commodityIndex],
                sourceTable,
                recommendationType,
                actionDate,
                actionTaken,
                comment,
                userDecision: actionTaken,
                userNotes,
                tags,
                memoryType,
                updatedAt: new Date().toISOString()
            };
            
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.closeModal();
            this.showNotification('SDO recommendation updated successfully!', 'success');
        }
    }

    deleteCommodity(id) {
        if (confirm('Are you sure you want to delete this SDO recommendation?')) {
            this.commodities = this.commodities.filter(c => c.id !== id);
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.showNotification('SDO recommendation deleted successfully!', 'success');
        }
    }

    editCommodity(id) {
        const commodity = this.commodities.find(c => c.id === id);
        
        if (commodity) {
            this.currentEditId = id;
            document.getElementById('editSourceTable').value = commodity.sourceTable;
            document.getElementById('editRecommendationType').value = commodity.recommendationType;
            document.getElementById('editActionDate').value = commodity.actionDate || '';
            document.getElementById('editActionTaken').value = commodity.actionTaken;
            document.getElementById('editComment').value = commodity.comment || '';
            document.getElementById('editUserNotes').value = commodity.userNotes;
            document.getElementById('editTags').value = commodity.tags.join(', ');
            document.getElementById('editMemoryType').value = commodity.memoryType || 'episodic';
            
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
        const recommendationTypeFilter = document.getElementById('filterRecommendationType').value;
        const memoryLayerFilter = document.getElementById('filterMemoryLayer').value;
        
        let filtered = this.commodities;
        
        if (searchTerm) {
            filtered = filtered.filter(commodity => 
                commodity.sourceTable.toLowerCase().includes(searchTerm) ||
                commodity.recommendationType.toLowerCase().includes(searchTerm) ||
                commodity.userNotes.toLowerCase().includes(searchTerm) ||
                commodity.comment.toLowerCase().includes(searchTerm) ||
                commodity.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }
        
        if (statusFilter !== 'all') {
            filtered = filtered.filter(commodity => commodity.actionTaken === statusFilter);
        }
        
        if (recommendationTypeFilter !== 'all') {
            filtered = filtered.filter(commodity => commodity.recommendationType === recommendationTypeFilter);
        }
        
        if (memoryLayerFilter !== 'all') {
            filtered = filtered.filter(commodity => commodity.memoryLayer === memoryLayerFilter);
        }
        
        this.renderCommodities(filtered);
    }

    renderCommodities(commoditiesToRender = this.commodities) {
        const container = document.getElementById('commoditiesList');
        const countElement = document.getElementById('commodityCount');
        
        countElement.textContent = `${commoditiesToRender.length} recommendations`;
        this.updateMemoryStats();
        this.updateMemoryTypeStats();
        
        if (commoditiesToRender.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>No SDO recommendations found. ${this.commodities.length === 0 ? 'Start by submitting your first recommendation!' : 'Try adjusting your search or filters.'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = commoditiesToRender.map(commodity => `
            <div class="commodity-card">
                <div class="commodity-card-header">
                    <div>
                        <div class="commodity-card-id">${this.escapeHtml(commodity.sourceTable)}</div>
                        <h3 class="commodity-card-name">${this.escapeHtml(commodity.recommendationType)}</h3>
                    </div>
                    <div class="commodity-card-badges">
                        <span class="commodity-card-status ${commodity.actionTaken}">${this.getActionLabel(commodity.actionTaken)}</span>
                        <span class="commodity-card-memory-layer ${commodity.memoryLayer}">${this.getMemoryLayerLabel(commodity.memoryLayer)}</span>
                        <span class="memory-type-badge ${commodity.memoryType || 'episodic'}">${this.getMemoryTypeLabel(commodity.memoryType)}</span>
                    </div>
                </div>
                <div class="commodity-card-body">
                    <div class="commodity-card-field">
                        <div class="commodity-card-field-label">Action Date</div>
                        <div class="commodity-card-field-value">${this.escapeHtml(commodity.actionDate || 'N/A')}</div>
                    </div>
                    <div class="commodity-card-field">
                        <div class="commodity-card-field-label">Action Taken</div>
                        <div class="commodity-card-field-value">${this.escapeHtml(commodity.actionTaken)}</div>
                    </div>
                </div>
                ${commodity.comment ? `
                    <div class="commodity-card-notes">
                        <div class="commodity-card-notes-label">Recommendation Comment</div>
                        <div class="commodity-card-notes-content">${this.escapeHtml(commodity.comment)}</div>
                    </div>
                ` : ''}
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
            'Accepted': '✅ Accepted',
            'Rejected': '❌ Rejected',
            'Auto-Accepted': '🤖 Auto-Accepted'
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

    getActionLabel(action) {
        const labels = {
            'Accepted': '✅ Accepted',
            'Rejected': '❌ Rejected',
            'Auto-Accepted': '🤖 Auto-Accepted'
        };
        return labels[action] || action;
    }

    getMemoryTypeLabel(type) {
        const labels = {
            'episodic': '🎭 Episodic',
            'procedural': '⚙️ Procedural',
            'semantic': '🧠 Semantic',
            'persona': '👤 Persona'
        };
        return labels[type] || type;
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

    updateMemoryTypeStats() {
        const episodicCount = this.commodities.filter(c => c.memoryType === 'episodic').length;
        const proceduralCount = this.commodities.filter(c => c.memoryType === 'procedural').length;
        const semanticCount = this.commodities.filter(c => c.memoryType === 'semantic').length;
        const personaCount = this.commodities.filter(c => c.memoryType === 'persona').length;

        document.getElementById('episodicCount').textContent = episodicCount;
        document.getElementById('proceduralCount').textContent = proceduralCount;
        document.getElementById('semanticCount').textContent = semanticCount;
        document.getElementById('personaCount').textContent = personaCount;
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

    evolveMemories() {
        let evolvedCount = 0;
        
        // Group memories by pattern to detect evolution triggers
        const patternGroups = {};
        
        this.commodities.forEach(commodity => {
            if (commodity.memoryType === 'episodic') {
                // Check for action pattern repetition (EPISODIC → PROCEDURAL)
                const actionPattern = `${commodity.recommendationType}_${commodity.actionTaken}`;
                if (!patternGroups[actionPattern]) {
                    patternGroups[actionPattern] = [];
                }
                patternGroups[actionPattern].push(commodity);
            }
        });

        // EPISODIC → PROCEDURAL: When same action pattern repeats 3+ times
        Object.keys(patternGroups).forEach(pattern => {
            const memories = patternGroups[pattern];
            if (memories.length >= 3) {
                memories.forEach(memory => {
                    if (memory.memoryType === 'episodic') {
                        memory.memoryType = 'procedural';
                        evolvedCount++;
                    }
                });
            }
        });

        // EPISODIC → SEMANTIC: When same recommendation type has consistent outcomes
        const outcomeGroups = {};
        this.commodities.forEach(commodity => {
            if (commodity.memoryType === 'episodic') {
                if (!outcomeGroups[commodity.recommendationType]) {
                    outcomeGroups[commodity.recommendationType] = {};
                }
                const outcome = commodity.actionTaken;
                if (!outcomeGroups[commodity.recommendationType][outcome]) {
                    outcomeGroups[commodity.recommendationType][outcome] = 0;
                }
                outcomeGroups[commodity.recommendationType][outcome]++;
            }
        });

        Object.keys(outcomeGroups).forEach(recType => {
            const outcomes = outcomeGroups[recType];
            const total = Object.values(outcomes).reduce((a, b) => a + b, 0);
            // If 80%+ of same recommendation type has same outcome, it's semantic
            Object.keys(outcomes).forEach(outcome => {
                if (outcomes[outcome] / total >= 0.8 && total >= 4) {
                    this.commodities.forEach(commodity => {
                        if (commodity.recommendationType === recType && 
                            commodity.actionTaken === outcome && 
                            commodity.memoryType === 'episodic') {
                            commodity.memoryType = 'semantic';
                            evolvedCount++;
                        }
                    });
                }
            });
        });

        // EPISODIC → PERSONA: When user consistently rejects/accepts certain types
        const userPatterns = {};
        this.commodities.forEach(commodity => {
            if (commodity.memoryType === 'episodic') {
                const pattern = `${commodity.recommendationType}_${commodity.actionTaken}`;
                if (!userPatterns[pattern]) {
                    userPatterns[pattern] = 0;
                }
                userPatterns[pattern]++;
            }
        });

        Object.keys(userPatterns).forEach(pattern => {
            if (userPatterns[pattern] >= 5) {
                const [recType, action] = pattern.split('_');
                this.commodities.forEach(commodity => {
                    if (commodity.recommendationType === recType && 
                        commodity.actionTaken === action && 
                        commodity.memoryType === 'episodic') {
                        commodity.memoryType = 'persona';
                        evolvedCount++;
                    }
                });
            }
        });

        // PERSONA → PROCEDURAL: When preferences become workflow rules
        // (Already handled by the pattern repetition logic above)

        // SEMANTIC → PROCEDURAL: When facts imply action rules
        // (Already handled by the pattern repetition logic above)

        if (evolvedCount > 0) {
            this.saveCommoditiesToStorage();
            this.renderCommodities();
            this.showNotification(`${evolvedCount} memories evolved to higher types`, 'success');
        } else {
            this.showNotification('No memories eligible for evolution', 'info');
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
