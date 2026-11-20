define(['core/ajax', 'core/notification'], function(ajax, notification) {
    /**
     * Returns a language string preloaded by strings_for_js() in view.php.
     *
     * @param {string} key String identifier.
     * @param {Object|string} [a] Optional value for {$a} placeholders.
     * @returns {string} Translated string.
     */
    function getString(key, a) {
        return M.util.get_string(key, 'mod_kanban', a);
    }

    return {
        init: function(cmid, kanbanid, autoOpenCardId, currentGroupId) {
            var draggedCard = null;
            var isDragging = false;

            // Search and quick filters keep dense course boards scannable without a reload.
            var searchInput = document.getElementById('kanban-search-input');
            var groupSearchInput = document.getElementById('kanban-group-search-input');
            var studentSearchInput = document.getElementById('kanban-student-search-input');
            var filterButtons = document.querySelectorAll('[data-kanban-filter]');
            var filterStatus = document.getElementById('kanban-filter-status');
            var activeFilter = 'all';

            function applyBoardFilters() {
                var taskQuery = searchInput ? searchInput.value.trim().toLocaleLowerCase() : '';
                var groupQuery = groupSearchInput ? groupSearchInput.value.trim().toLocaleLowerCase() : '';
                var studentQuery = studentSearchInput ? studentSearchInput.value.trim().toLocaleLowerCase() : '';
                var visible = 0;
                document.querySelectorAll('.kanban-card').forEach(function(card) {
                    var taskText = ((card.dataset.title || '') + ' ' + (card.dataset.description || '')).toLocaleLowerCase();
                    var groupText = (card.dataset.group || '').toLocaleLowerCase();
                    var studentText = (card.dataset.assignees || '').toLocaleLowerCase();
                    var matchesSearch = (!taskQuery || taskText.indexOf(taskQuery) !== -1) &&
                        (!groupQuery || groupText.indexOf(groupQuery) !== -1) &&
                        (!studentQuery || studentText.indexOf(studentQuery) !== -1);
                    var matchesQuick = activeFilter === 'all' ||
                        (activeFilter === 'mine' && card.dataset.mine === '1') ||
                        (activeFilter === 'overdue' && card.dataset.overdue === '1') ||
                        (activeFilter === 'unassigned' && card.dataset.unassigned === '1');
                    card.hidden = !(matchesSearch && matchesQuick);
                    if (!card.hidden) {
                        visible++;
                    }
                });
                document.querySelectorAll('.kanban-column').forEach(function(column) {
                    column.classList.toggle('is-empty-filtered', !column.querySelector('.kanban-card:not([hidden])'));
                });
                if (filterStatus) {
                    filterStatus.textContent = getString('visiblecards', visible);
                }
            }

            if (searchInput) {
                searchInput.addEventListener('input', applyBoardFilters);
            }
            if (groupSearchInput) {
                groupSearchInput.addEventListener('input', applyBoardFilters);
            }
            if (studentSearchInput) {
                studentSearchInput.addEventListener('input', applyBoardFilters);
            }
            filterButtons.forEach(function(button) {
                button.addEventListener('click', function() {
                    activeFilter = this.dataset.kanbanFilter;
                    filterButtons.forEach(function(item) {
                        var selected = item === button;
                        item.classList.toggle('active', selected);
                        item.setAttribute('aria-pressed', selected ? 'true' : 'false');
                    });
                    applyBoardFilters();
                });
            });
            applyBoardFilters();

            // ==========================================
            // 1. DRAG & DROP CARDS
            // ==========================================
            document.querySelectorAll('.kanban-card').forEach(function(card) {
                card.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDetailModal(this);
                    }
                });
                card.addEventListener('dragstart', function(e) {
                    isDragging = true;
                    draggedCard = this;
                    this.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', this.dataset.cardid);
                });

                card.addEventListener('dragend', function() {
                    this.classList.remove('dragging');
                    draggedCard = null;
                    setTimeout(function() {
                        isDragging = false;
                    }, 100);
                });
            });

            // Drop zones (columns).
            document.querySelectorAll('.kanban-card-list').forEach(function(column) {
                column.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    this.classList.add('dragover');
                    if (draggedCard) {
                        var afterElement = Array.from(this.querySelectorAll('.kanban-card:not(.dragging)'))
                            .find(function(card) {
                                var rect = card.getBoundingClientRect();
                                return e.clientY < rect.top + rect.height / 2;
                            });
                        if (afterElement) {
                            this.insertBefore(draggedCard, afterElement);
                        } else {
                            this.appendChild(draggedCard);
                        }
                    }
                });

                column.addEventListener('dragleave', function() {
                    this.classList.remove('dragover');
                });

                column.addEventListener('drop', function(e) {
                    e.preventDefault();
                    this.classList.remove('dragover');
                    if (draggedCard) {
                        var targetColumnId = this.dataset.columnid;
                        var cardId = draggedCard.dataset.cardid;
                        var newPosition = Array.from(this.querySelectorAll('.kanban-card'))
                            .indexOf(draggedCard);

                        var placeholder = this.querySelector('.empty-column-placeholder');
                        if (placeholder) {
                            placeholder.remove();
                        }

                        ajax.call([{
                            methodname: 'mod_kanban_move_card',
                            args: {
                                cardid: parseInt(cardId),
                                targetcolumnid: parseInt(targetColumnId),
                                cmid: parseInt(cmid),
                                newposition: newPosition
                            }
                        }])[0].done(function(response) {
                            if (response.status) {
                                window.location.reload();
                            }
                        }).fail(notification.exception);
                    }
                });
            });

            // ==========================================
            // 2. ADD CARD MODAL
            // ==========================================
            var modal = document.getElementById('modalAddCard');
            var errorAlert = document.getElementById('card-error-alert');
            var attachmentsInput = document.getElementById('card-attachments-input');

            /**
             * Opens the card creation modal for a column.
             *
             * @param {number} columnId Column identifier.
             */
            function openModal(columnId) {
                // re-query modal in case it wasn't in DOM at init time
                modal = document.getElementById('modalAddCard');
                if (!modal) {
                    return;
                }
                var colInput = document.getElementById('card-column-id');
                if (colInput) {
                    colInput.value = columnId;
                }
                document.getElementById('card-title-input').value = '';
                document.getElementById('card-desc-input').value = '';
                document.getElementById('card-duedate-input').value = '';
                document.getElementById('card-url-input').value = '';
                attachmentsInput = document.getElementById('card-attachments-input');
                if (attachmentsInput) {
                    attachmentsInput.value = '';
                }
                var assigneeBox = document.getElementById('card-assignee-input');
                if (assigneeBox) {
                    Array.from(assigneeBox.querySelectorAll('input[type="checkbox"]')).forEach(function(box) {
                        box.checked = false;
                    });
                }
                if (errorAlert) {
                    errorAlert.classList.add('d-none');
                    errorAlert.innerText = '';
                }

                // Show the modal and its backdrop.
                modal.style.display = 'block';
                modal.classList.add('show');
                modal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('modal-open');
                document.getElementById('card-title-input').focus();

                var backdrop = document.getElementById('custom-modal-backdrop');
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.id = 'custom-modal-backdrop';
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
            }

            /**
             * Closes the card creation modal.
             */
            function closeModal() {
                if (!modal) {
                    return;
                }
                modal.style.display = 'none';
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');
                var backdrop = document.getElementById('custom-modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            }

            // ==========================================
            // CARD DETAIL MODAL
            // ==========================================
            var detailModal = null;

            /**
             * Opens the detail modal and loads card activity.
             *
             * @param {HTMLElement} cardElement Card element.
             */
            function openDetailModal(cardElement) {
                if (isDragging) {
                    return;
                }

                detailModal = document.getElementById('modalCardDetail');
                if (!detailModal) {
                    return;
                }

                var cardId = cardElement.dataset.cardid;
                detailModal.dataset.cardid = cardId;
                var commentsEl = document.getElementById('detail-card-comments');
                var historyEl = document.getElementById('detail-card-history');
                var attachmentsEl = document.getElementById('detail-card-attachments');
                commentsEl.innerHTML = '<div class="text-muted">' + getString('loading') + '</div>';
                if (historyEl) {
                    historyEl.innerHTML = '';
                }
                if (attachmentsEl) {
                    attachmentsEl.innerHTML = '<div class="text-muted">' + getString('loadingattachments') + '</div>';
                }
                ajax.call([{
                    methodname: 'mod_kanban_get_card_activity',
                    args: {cardid: parseInt(cardId), cmid: parseInt(cmid)}
                }])[0].done(function(activity) {
                    commentsEl.innerHTML = activity.comments.length ? activity.comments.map(function(item) {
                        return '<div class="border-bottom py-2"><strong>' + escapeHtml(item.author) + '</strong>' +
                            '<small class="text-muted ms-2">' + escapeHtml(item.timecreated) + '</small><div>' +
                            escapeHtml(item.comment) + '</div></div>';
                    }).join('') : '<div class="text-muted">' + getString('nocomments') + '</div>';
                    if (historyEl) {
                        historyEl.innerHTML = activity.history.length ? activity.history.map(function(item) {
                            return '<div class="border-bottom py-2"><strong>' + escapeHtml(item.author) + '</strong> ' +
                                escapeHtml(item.details || item.action) + '<small class="text-muted d-block">' +
                                escapeHtml(item.timecreated) + '</small></div>';
                        }).join('') : '<div class="text-muted">' + getString('nohistory') + '</div>';
                    }
                }).fail(function() {
                    commentsEl.innerHTML = '<div class="text-danger">' + getString('activityloaderror') + '</div>';
                });

                ajax.call([{
                    methodname: 'mod_kanban_get_card_files',
                    args: {cardid: parseInt(cardId), cmid: parseInt(cmid)}
                }])[0].done(function(response) {
                    if (!attachmentsEl) {
                        return;
                    }
                    if (!response.files || !response.files.length) {
                        attachmentsEl.innerHTML = '<span class="text-muted">' + getString('nofiles') + '</span>';
                        return;
                    }
                    attachmentsEl.innerHTML = response.files.map(function(file) {
                        var deleteButton = '';
                        if (file.candelete) {
                            deleteButton = '<button type="button" class="btn btn-link btn-sm text-danger p-0 ms-2 ' +
                            'delete-card-file" data-filehash="' + escapeHtml(file.hash) + '" data-cardid="' +
                            cardId + '" title="' + getString('deletefile') + '"><i class="fa fa-trash"></i></button>';
                        }
                        var fileLabel = file.filearea === 'submission_files' ? getString('submissionfile') : getString('taskfile');
                        return '<div class="d-flex align-items-center justify-content-between border-bottom py-2">' +
                            '<a href="' + escapeHtml(file.url) + '" target="_blank" ' +
                            'class="text-primary text-decoration-underline me-2">' +
                            escapeHtml(file.filename) + '</a><small class="text-muted">' + escapeHtml(fileLabel) + ' (' +
                            (file.size || 0) + ' bytes)</small>' + deleteButton + '</div>';
                    }).join('');
                }).fail(function() {
                    if (attachmentsEl) {
                        attachmentsEl.innerHTML = '<span class="text-muted">' + getString('fileloaderror') + '</span>';
                    }
                });
                var titleEl = cardElement.querySelector('.fw-bold.text-dark');
                var descEl = cardElement.querySelector('.text-muted.small.text-truncate');
                var title = titleEl ? titleEl.textContent.trim() : getString('notitle');
                var desc = descEl ? descEl.textContent.trim() : getString('nodesc');

                // Read the due date from the card element.
                var duedateText = '';
                var alertClass = 'd-none';
                var alertText = '';

                var dueDateContainer = cardElement.querySelector('.mt-2.pt-2.border-top');
                if (dueDateContainer && dueDateContainer.querySelector('.badge.bg-danger')) {
                    duedateText = dueDateContainer.querySelector('.badge.bg-danger').textContent.trim();
                    alertClass = '';
                    alertText = getString('overduealert');
                } else if (dueDateContainer && dueDateContainer.querySelector('.badge.bg-warning')) {
                    duedateText = dueDateContainer.querySelector('.badge.bg-warning').textContent.trim();
                    alertClass = '';
                    alertText = getString('duesoonalert');
                } else if (dueDateContainer && dueDateContainer.querySelector('small.text-muted')) {
                    duedateText = dueDateContainer.querySelector('small.text-muted').textContent.trim();
                }

                // Fill the modal with the card data.
                document.getElementById('detail-card-title').textContent = title;
                document.getElementById('detail-card-desc').textContent = desc || getString('nodesc');
                document.getElementById('detail-card-assignee').textContent =
                    cardElement.dataset.assignees || getString('dashboard_unassigned');
                document.getElementById('detail-card-duedate').textContent = duedateText || getString('noduedate');
                document.getElementById('detail-card-status').textContent =
                    cardElement.dataset.columntitle || getString('unknown');

                document.getElementById('detail-card-creator').textContent = cardElement.dataset.creator || getString('unknown');
                document.getElementById('detail-card-created').textContent = cardElement.dataset.timecreated || '';
                document.getElementById('detail-card-updated').textContent = cardElement.dataset.timemodified || '';

                // Assignment material and learner submission links are deliberately separate.
                var taskUrl = cardElement.dataset.taskurl;
                var urlContainer = document.getElementById('detail-card-url-container');
                var urlAnchor = document.getElementById('detail-card-url');
                if (taskUrl && taskUrl.trim() !== '') {
                    urlAnchor.href = taskUrl;
                    urlAnchor.textContent = taskUrl;
                    urlContainer.classList.remove('d-none');
                } else {
                    urlContainer.classList.add('d-none');
                }
                var submissionUrl = cardElement.dataset.submissionurl;
                var submissionContainer = document.getElementById('detail-submission-url-container');
                var submissionAnchor = document.getElementById('detail-submission-url');
                if (submissionUrl && submissionUrl.trim() !== '') {
                    submissionAnchor.href = submissionUrl;
                    submissionAnchor.textContent = submissionUrl;
                    submissionContainer.classList.remove('d-none');
                } else {
                    submissionContainer.classList.add('d-none');
                }
                var workflowSelect = document.getElementById('detail-workflow-state');
                if (workflowSelect) {
                    workflowSelect.value = cardElement.dataset.workflowstate || 'notstarted';
                }
                var submissionInput = document.getElementById('detail-submission-url-input');
                if (submissionInput) {
                    submissionInput.value = submissionUrl || '';
                }

                var alertEl = document.getElementById('detail-card-alert');
                if (alertClass === '') {
                    alertEl.classList.remove('d-none');
                    alertEl.textContent = alertText;
                } else {
                    alertEl.classList.add('d-none');
                }

                // Show the modal.
                detailModal.style.display = 'block';
                detailModal.classList.add('show');
                detailModal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('modal-open');

                var backdrop = document.getElementById('detail-modal-backdrop');
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.id = 'detail-modal-backdrop';
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
            }

            /**
             * Escapes text before inserting it into HTML.
             *
             * @param {string} value Text to escape.
             * @returns {string} Escaped HTML.
             */
            function escapeHtml(value) {
                var div = document.createElement('div');
                div.textContent = value || '';
                return div.innerHTML;
            }

            /**
             * Closes the card detail modal.
             */
            function closeDetailModal() {
                if (!detailModal) {
                    return;
                }
                detailModal.style.display = 'none';
                detailModal.classList.remove('show');
                detailModal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');
                var backdrop = document.getElementById('detail-modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            }

            // ==========================================
            // 2b. EDIT CARD (including assignees)
            // ==========================================
            var editModal = null;
            var editErrorAlert = null;

            /**
             * Converts a unix timestamp to datetime-local input value.
             *
             * @param {number} timestamp Unix timestamp in seconds.
             * @returns {string} Value suitable for datetime-local input.
             */
            function timestampToDatetimeLocal(timestamp) {
                if (!timestamp) {
                    return '';
                }
                var d = new Date(timestamp * 1000);
                var pad = function(n) {
                    return (n < 10 ? '0' : '') + n;
                };
                return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            }

            /**
             * Opens the edit modal and prefills card data.
             *
             * @param {HTMLElement} cardElement Card element.
             */
            function openEditModal(cardElement) {
                if (isDragging) {
                    return;
                }
                editModal = document.getElementById('modalEditCard');
                if (!editModal) {
                    return;
                }
                editErrorAlert = document.getElementById('edit-card-error-alert');
                var cardId = cardElement.dataset.cardid;
                document.getElementById('edit-card-id').value = cardId;
                document.getElementById('edit-card-title-input').value = cardElement.dataset.title || '';
                var rawDesc = cardElement.querySelector('.card-desc-raw');
                document.getElementById('edit-card-desc-input').value = rawDesc ? rawDesc.textContent.trim() : '';
                document.getElementById('edit-card-duedate-input').value =
                    timestampToDatetimeLocal(parseInt(cardElement.dataset.duedate || '0', 10));
                document.getElementById('edit-card-url-input').value = cardElement.dataset.taskurl || '';
                var selectedIds = (cardElement.dataset.assigneeids || '').split(',').map(function(s) {
                    return s.trim();
                }).filter(function(s) {
                    return s !== '';
                });
                var editAssigneeBox = document.getElementById('edit-card-assignee-input');
                if (editAssigneeBox) {
                    Array.from(editAssigneeBox.querySelectorAll('input[type="checkbox"]')).forEach(function(box) {
                        box.checked = selectedIds.indexOf(box.value) !== -1;
                    });
                }
                if (editErrorAlert) {
                    editErrorAlert.classList.add('d-none');
                    editErrorAlert.innerText = '';
                }
                editModal.style.display = 'block';
                editModal.classList.add('show');
                document.body.classList.add('modal-open');
                var backdrop = document.getElementById('edit-modal-backdrop');
                if (!backdrop) {
                    backdrop = document.createElement('div');
                    backdrop.id = 'edit-modal-backdrop';
                    backdrop.className = 'modal-backdrop fade show';
                    document.body.appendChild(backdrop);
                }
            }

            /**
             * Closes the edit modal.
             */
            function closeEditModal() {
                if (!editModal) {
                    editModal = document.getElementById('modalEditCard');
                }
                if (!editModal) {
                    return;
                }
                editModal.style.display = 'none';
                editModal.classList.remove('show');
                document.body.classList.remove('modal-open');
                var backdrop = document.getElementById('edit-modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                }
            }

            document.addEventListener('click', function(e) {
                var editButton = e.target.closest && e.target.closest('.btn-edit-card');
                if (editButton) {
                    e.preventDefault();
                    e.stopPropagation();
                    var editCard = editButton.closest('.kanban-card');
                    if (editCard) {
                        openEditModal(editCard);
                    }
                    return;
                }
                var dismissEdit = e.target.closest && e.target.closest(
                    '#modalEditCard [data-bs-dismiss="modal"], #modalEditCard .btn-close, ' +
                    '#modalEditCard .btn-secondary'
                );
                if (dismissEdit) {
                    closeEditModal();
                    return;
                }
                if (editModal && editModal.style.display === 'block' && e.target.id === 'edit-modal-backdrop') {
                    closeEditModal();
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    if (detailModal && detailModal.classList.contains('show')) {
                        closeDetailModal();
                    } else if (columnModal && columnModal.classList.contains('show')) {
                        closeColumnModal();
                    } else if (modal && modal.classList.contains('show')) {
                        closeModal();
                    }
                }
            });

            document.addEventListener('click', function(e) {
                if (e.target.closest && e.target.closest('#btn-update-card')) {
                    var cardIdVal = document.getElementById('edit-card-id').value;
                    var newTitle = document.getElementById('edit-card-title-input').value.trim();
                    var newDesc = document.getElementById('edit-card-desc-input').value.trim();
                    var newDuedateStr = document.getElementById('edit-card-duedate-input').value;
                    var newUrl = document.getElementById('edit-card-url-input').value.trim();
                    var newAssigneeBox = document.getElementById('edit-card-assignee-input');
                    var newAssigneeIds = [];
                    if (newAssigneeBox) {
                        var checkedBoxes = newAssigneeBox.querySelectorAll('input[type="checkbox"]:checked');
                        newAssigneeIds = Array.from(checkedBoxes).map(function(box) {
                            return parseInt(box.value, 10);
                        }).filter(function(value) {
                            return !isNaN(value);
                        });
                    }
                    editErrorAlert = document.getElementById('edit-card-error-alert');
                    if (!newTitle) {
                        editErrorAlert.innerText = getString('required');
                        editErrorAlert.classList.remove('d-none');
                        return;
                    }
                    var newDuedateTimestamp = 0;
                    if (newDuedateStr) {
                        var selectedDate = new Date(newDuedateStr);
                        var now = new Date();
                        if (selectedDate.getTime() < (now.getTime() - 60000)) {
                            editErrorAlert.innerText = getString('error_duedate_past');
                            editErrorAlert.classList.remove('d-none');
                            return;
                        }
                        newDuedateTimestamp = Math.floor(selectedDate.getTime() / 1000);
                    }
                    ajax.call([{
                        methodname: 'mod_kanban_update_card',
                        args: {
                            cardid: parseInt(cardIdVal),
                            cmid: parseInt(cmid),
                            title: newTitle,
                            description: newDesc,
                            duedate: newDuedateTimestamp,
                            submissionurl: newUrl,
                            assignees: newAssigneeIds
                        }
                    }])[0].done(function(response) {
                        if (response.status) {
                            closeEditModal();
                            window.location.reload();
                        }
                    }).fail(function(error) {
                        var message = (error && error.message) ? error.message : getString('errorgeneric');
                        editErrorAlert.innerText = message;
                        editErrorAlert.classList.remove('d-none');
                    });
                }
            });

            // Open the detail modal when a card is clicked.
            document.addEventListener('click', function(e) {
                if (isDragging) {
                    return;
                }

                if (e.target.closest && (e.target.closest('.btn-edit-card') || e.target.closest('#modalEditCard'))) {
                    return;
                }

                var viewButton = e.target.closest && e.target.closest('.btn-view-card');
                if (viewButton) {
                    e.preventDefault();
                    e.stopPropagation();
                    var viewCard = viewButton.closest('.kanban-card');
                    if (viewCard) {
                        openDetailModal(viewCard);
                    }
                    return;
                }

                var card = e.target.closest && e.target.closest('.kanban-card');
                if (card && !e.target.closest('.btn-delete-card') && !e.target.closest('.btn-edit-card') &&
                    !e.target.closest('.btn-view-card') && !e.target.closest('.badge')) {
                    openDetailModal(card);
                    return;
                }
            });

            document.addEventListener('click', function(e) {
                var submit = e.target.closest && e.target.closest('#detail-card-comment-submit');
                if (!submit) {
                    return;
                }
                var input = document.getElementById('detail-card-comment-input');
                var cardId = detailModal.dataset.cardid;
                var card = document.querySelector('.kanban-card[data-cardid="' + cardId + '"]');
                if (!input.value.trim() || !cardId) {
                    return;
                }
                ajax.call([{
                    methodname: 'mod_kanban_add_comment',
                    args: {cardid: parseInt(cardId), cmid: parseInt(cmid), comment: input.value.trim()}
                }])[0].done(function() {
                    input.value = '';
                    if (card) {
                        openDetailModal(card);
                    }
                }).fail(notification.exception);
            });

            document.addEventListener('click', function(e) {
                var progressButton = e.target.closest && e.target.closest('#detail-progress-submit');
                if (progressButton) {
                    var progressCardId = parseInt(detailModal.dataset.cardid, 10);
                    progressButton.disabled = true;
                    ajax.call([{
                        methodname: 'mod_kanban_update_progress',
                        args: {
                            cardid: progressCardId,
                            cmid: parseInt(cmid, 10),
                            workflowstate: document.getElementById('detail-workflow-state').value,
                            submissionurl: document.getElementById('detail-submission-url-input').value.trim()
                        }
                    }])[0].done(function() {
                        window.location.reload();
                    }).fail(function(error) {
                        document.getElementById('detail-action-message').textContent =
                            (error && error.message) ? error.message : getString('errorgeneric');
                        progressButton.disabled = false;
                    });
                    return;
                }

                var approveButton = e.target.closest && e.target.closest('#detail-approve');
                if (approveButton) {
                    approveButton.disabled = true;
                    ajax.call([{
                        methodname: 'mod_kanban_update_progress',
                        args: {
                            cardid: parseInt(detailModal.dataset.cardid, 10),
                            cmid: parseInt(cmid, 10),
                            workflowstate: 'completed',
                            submissionurl: document.getElementById('detail-submission-url-input').value.trim()
                        }
                    }])[0].done(function() {
                        window.location.href = M.cfg.wwwroot + '/mod/kanban/dashboard.php?id=' +
                            parseInt(cmid, 10) + '&group=' + parseInt(currentGroupId || 0, 10);
                    }).fail(function(error) {
                        document.getElementById('detail-action-message').textContent =
                            (error && error.message) ? error.message : getString('errorgeneric');
                        approveButton.disabled = false;
                    });
                    return;
                }

                var revisionButton = e.target.closest && e.target.closest('#detail-request-revision');
                if (revisionButton) {
                    var feedbackInput = document.getElementById('detail-card-comment-input');
                    var feedback = feedbackInput ? feedbackInput.value.trim() : '';
                    if (!feedback) {
                        document.getElementById('detail-action-message').textContent =
                            getString('revisioncommentrequired');
                        return;
                    }
                    revisionButton.disabled = true;
                    ajax.call([{
                        methodname: 'mod_kanban_add_comment',
                        args: {
                            cardid: parseInt(detailModal.dataset.cardid, 10),
                            cmid: parseInt(cmid, 10),
                            comment: feedback
                        }
                    }])[0].done(function() {
                        ajax.call([{
                            methodname: 'mod_kanban_update_progress',
                            args: {
                                cardid: parseInt(detailModal.dataset.cardid, 10),
                                cmid: parseInt(cmid, 10),
                                workflowstate: 'inprogress',
                                submissionurl: document.getElementById('detail-submission-url-input').value.trim()
                            }
                        }])[0].done(function() {
                            window.location.href = M.cfg.wwwroot + '/mod/kanban/dashboard.php?id=' +
                                parseInt(cmid, 10) + '&group=' + parseInt(currentGroupId || 0, 10);
                        }).fail(notification.exception);
                    }).fail(function(error) {
                        document.getElementById('detail-action-message').textContent =
                            (error && error.message) ? error.message : getString('errorgeneric');
                        revisionButton.disabled = false;
                    });
                    return;
                }

                var uploadButton = e.target.closest && e.target.closest(
                    '#detail-submission-file-submit, #detail-task-file-submit'
                );
                if (uploadButton) {
                    var fileInput = document.getElementById('detail-file-input');
                    var message = document.getElementById('detail-action-message');
                    if (!fileInput.files.length) {
                        message.textContent = getString('error_upload_empty');
                        return;
                    }
                    var uploadData = new FormData();
                    uploadData.append('cmid', cmid);
                    uploadData.append('cardid', detailModal.dataset.cardid);
                    uploadData.append('kind', uploadButton.id === 'detail-task-file-submit' ? 'task' : 'submission');
                    uploadData.append('sesskey', M.cfg.sesskey);
                    Array.from(fileInput.files).forEach(function(file) {
                        uploadData.append('attachments[]', file);
                    });
                    uploadButton.disabled = true;
                    fetch(M.cfg.wwwroot + '/mod/kanban/upload_card_file.php', {
                        method: 'POST', body: uploadData, credentials: 'same-origin'
                    }).then(function(response) {
                        return response.json().then(function(data) {
                            if (!response.ok || !data.status) {
                                throw new Error(data.message || getString('errorgeneric'));
                            }
                            return data;
                        });
                    }).then(function() {
                        var detailCard = document.querySelector('.kanban-card[data-cardid="' +
                            detailModal.dataset.cardid + '"]');
                        fileInput.value = '';
                        openDetailModal(detailCard);
                    }).catch(function(error) {
                        message.textContent = error.message || getString('errorgeneric');
                    }).finally(function() {
                        uploadButton.disabled = false;
                    });
                    return;
                }

                var deleteFileBtn = e.target.closest && e.target.closest('.delete-card-file');
                if (!deleteFileBtn) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                var fileHash = deleteFileBtn.dataset.filehash;
                var cardId = deleteFileBtn.dataset.cardid;
                if (!fileHash || !cardId) {
                    return;
                }
                if (!confirm(getString('confirmdeletefile'))) {
                    return;
                }
                ajax.call([{
                    methodname: 'mod_kanban_delete_card_file',
                    args: {cardid: parseInt(cardId), cmid: parseInt(cmid), filehash: fileHash}
                }])[0].done(function() {
                    var card = document.querySelector('.kanban-card[data-cardid="' + cardId + '"]');
                    if (card) {
                        openDetailModal(card);
                    }
                }).fail(notification.exception);
            });

            // Close the detail modal.
            document.addEventListener('click', function(e) {
                if (isDragging) {
                    return;
                }
                var closeBtn = e.target.closest && e.target.closest('#modalCardDetail .btn-close, #modalCardDetail .btn-secondary');
                if (closeBtn) {
                    closeDetailModal();
                    return;
                }
            });

            // Close the modal when the backdrop is clicked.
            document.addEventListener('click', function(e) {
                if (detailModal && detailModal.style.display === 'block' && e.target.id === 'detail-modal-backdrop') {
                    closeDetailModal();
                }
            });

            // Use event delegation so handlers work even if elements are added later
            document.addEventListener('click', function(e) {
                var btn = e.target.closest && e.target.closest('.btn-open-modal');
                if (btn) {
                    e.preventDefault();
                    var colId = btn.dataset.columnid;
                    openModal(colId);
                    return;
                }

                var dismissAdd = e.target.closest && e.target.closest(
                    '#modalAddCard [data-bs-dismiss="modal"], #modalAddCard .btn-close, ' +
                    '#modalAddCard .modal .btn-secondary'
                );
                if (dismissAdd) {
                    closeModal();
                    return;
                }

            });

            // ==========================================
            // 3. CREATE CARD & DATE VALIDATION
            // ==========================================
            var btnSubmit = document.getElementById('btn-submit-card');
            if (btnSubmit) {
                btnSubmit.addEventListener('click', function() {
                    var columnId = document.getElementById('card-column-id').value;
                    var title = document.getElementById('card-title-input').value.trim();
                    var desc = document.getElementById('card-desc-input').value.trim();
                    var duedateStr = document.getElementById('card-duedate-input').value;
                    var assigneeBox = document.getElementById('card-assignee-input');
                    var assigneeIds = [];
                    if (assigneeBox) {
                        var createChecked = assigneeBox.querySelectorAll('input[type="checkbox"]:checked');
                        assigneeIds = Array.from(createChecked).map(function(box) {
                            return parseInt(box.value, 10);
                        }).filter(function(value) {
                            return !isNaN(value);
                        });
                    }

                    // Validate the task name.
                    if (!title) {
                        errorAlert.innerText = getString('required');
                        errorAlert.classList.remove('d-none');
                        return;
                    }

                    // Validate the due date.
                    var duedateTimestamp = 0;
                    if (duedateStr) {
                        var selectedDate = new Date(duedateStr);
                        var now = new Date();

                        // Reject a date in the past.
                        if (selectedDate.getTime() < (now.getTime() - 60000)) {
                            errorAlert.innerText = getString('error_duedate_past');
                            errorAlert.classList.remove('d-none');
                            return;
                        }

                        duedateTimestamp = Math.floor(selectedDate.getTime() / 1000);
                    }

                    if (!duedateStr || !assigneeIds.length) {
                        errorAlert.innerText = getString('error_assignment_fields_required');
                        errorAlert.classList.remove('d-none');
                        return;
                    }
                    var taskUrl = document.getElementById('card-url-input').value.trim();
                    var formData = new FormData();
                    formData.append('kanbanid', kanbanid);
                    formData.append('columnid', columnId);
                    formData.append('cmid', cmid);
                    formData.append('title', title);
                    formData.append('description', desc);
                    formData.append('duedate', duedateTimestamp);
                    formData.append('taskurl', taskUrl);
                    formData.append('sesskey', M.cfg.sesskey);
                    assigneeIds.forEach(function(assigneeId) {
                        formData.append('assignees[]', assigneeId);
                    });
                    if (attachmentsInput && attachmentsInput.files && attachmentsInput.files.length) {
                        Array.from(attachmentsInput.files).forEach(function(file) {
                            formData.append('attachments[]', file);
                        });
                    }

                    var submitButton = document.getElementById('btn-submit-card');
                    submitButton.disabled = true;
                    submitButton.setAttribute('aria-busy', 'true');
                    fetch(M.cfg.wwwroot + '/mod/kanban/upload_and_create_card.php', {
                        method: 'POST',
                        body: formData,
                        credentials: 'same-origin'
                    }).then(function(response) {
                        return response.text().then(function(text) {
                            var data;
                            try {
                                data = JSON.parse(text);
                            } catch (parseError) {
                                throw new Error(getString('errornotjson', {
                                    status: response.status,
                                    body: (text || '').substring(0, 300)
                                }));
                            }
                            if (!response.ok || !data.status) {
                                throw new Error(data.message || getString('errorhttpcode', response.status));
                            }
                            return data;
                        });
                    }).then(function() {
                        closeModal();
                        window.location.reload();
                    }).catch(function(error) {
                        errorAlert.innerText = error.message || getString('errorgeneric');
                        errorAlert.classList.remove('d-none');
                    }).finally(function() {
                        submitButton.disabled = false;
                        submitButton.removeAttribute('aria-busy');
                    });
                });
            }

            /**
             * Calls a column management external function.
             *
             * @param {string} methodname External function name.
             * @param {Object} args External function arguments.
             * @returns {Promise} Moodle AJAX request.
             */
            function columnRequest(methodname, args) {
                args.cmid = parseInt(cmid);
                return ajax.call([{methodname: methodname, args: args}])[0];
            }

            /**
             * Gets column IDs in their current visual order.
             *
             * @returns {number[]} Column identifiers.
             */
            function getColumnIds() {
                return Array.from(document.querySelectorAll('.kanban-column')).map(function(column) {
                    return parseInt(column.dataset.columnid, 10);
                });
            }

            var columnModal = document.getElementById('modalColumn');
            function closeColumnModal() {
                if (!columnModal) {
                    return;
                }
                columnModal.classList.remove('show');
                columnModal.style.display = 'none';
                columnModal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('modal-open');
            }

            function openColumnModal(data) {
                if (!columnModal) {
                    return;
                }
                document.getElementById('column-id-input').value = data.columnid || '';
                document.getElementById('column-title-input').value = data.title || '';
                document.getElementById('column-description-input').value = data.description || '';
                document.getElementById('column-color-input').value = data.color || '#eef4f8';
                document.getElementById('column-wip-input').value = data.wip || '0';
                document.getElementById('column-error-alert').classList.add('d-none');
                columnModal.style.display = 'block';
                columnModal.classList.add('show');
                columnModal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('modal-open');
                document.getElementById('column-title-input').focus();
            }

            document.addEventListener('click', function(e) {
                var addButton = e.target.closest && e.target.closest('.btn-add-column');
                var editButton = e.target.closest && e.target.closest('.btn-edit-column');
                var deleteButton = e.target.closest && e.target.closest('.btn-delete-column');
                var moveButton = e.target.closest && e.target.closest('.btn-move-column');

                if (addButton || editButton) {
                    openColumnModal(editButton ? editButton.dataset : {});
                    return;
                }

                if (deleteButton) {
                    if (!confirm(getString('confirmdeletecolumn', deleteButton.dataset.title))) {
                        return;
                    }
                    columnRequest('mod_kanban_delete_column', {
                        columnid: parseInt(deleteButton.dataset.columnid)
                    }).done(function() {
                        window.location.reload();
                    }).fail(notification.exception);
                    return;
                }

                if (moveButton) {
                    var ids = getColumnIds();
                    var columnId = parseInt(moveButton.dataset.columnid);
                    var index = ids.indexOf(columnId);
                    var target = index + parseInt(moveButton.dataset.direction, 10);
                    if (index < 0 || target < 0 || target >= ids.length) {
                        return;
                    }
                    var moved = ids.splice(index, 1)[0];
                    ids.splice(target, 0, moved);
                    columnRequest('mod_kanban_reorder_columns', {
                        kanbanid: parseInt(kanbanid),
                        columnids: ids
                    }).done(function() {
                        window.location.reload();
                    }).fail(notification.exception);
                }
            });

            document.addEventListener('click', function(e) {
                if (e.target.closest && e.target.closest('[data-column-dismiss]')) {
                    closeColumnModal();
                    return;
                }
                if (!(e.target.closest && e.target.closest('#btn-save-column'))) {
                    return;
                }
                var id = document.getElementById('column-id-input').value;
                var title = document.getElementById('column-title-input').value.trim();
                var description = document.getElementById('column-description-input').value.trim();
                var color = document.getElementById('column-color-input').value;
                var wip = parseInt(document.getElementById('column-wip-input').value, 10) || 0;
                var error = document.getElementById('column-error-alert');
                if (!title) {
                    error.textContent = getString('required');
                    error.classList.remove('d-none');
                    return;
                }
                var method = id ? 'mod_kanban_update_column' : 'mod_kanban_create_column';
                var args = {title: title, description: description, color: color, wip_limit: wip};
                if (id) {
                    args.columnid = parseInt(id, 10);
                } else {
                    args.kanbanid = parseInt(kanbanid, 10);
                }
                e.target.disabled = true;
                columnRequest(method, args).done(function() {
                    window.location.reload();
                }).fail(function(exception) {
                    error.textContent = exception.message || getString('errorgeneric');
                    error.classList.remove('d-none');
                    e.target.disabled = false;
                });
            });

            // ==========================================
            // 4. DELETE CARD
            // ==========================================
            document.querySelectorAll('.btn-delete-card').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var cardId = this.dataset.cardid;
                    if (confirm(getString('confirmdeletecard'))) {
                        ajax.call([{
                            methodname: 'mod_kanban_delete_card',
                            args: {
                                cardid: parseInt(cardId),
                                cmid: parseInt(cmid)
                            }
                        }])[0].done(function(response) {
                            if (response.status) {
                                window.location.reload();
                            }
                        }).fail(notification.exception);
                    }
                });
            });

            // Dashboard deep link: open the requested card detail after all handlers are ready.
            if (autoOpenCardId) {
                var autoOpenCard = document.querySelector(
                    '.kanban-card[data-cardid="' + parseInt(autoOpenCardId, 10) + '"]'
                );
                if (autoOpenCard) {
                    autoOpenCard.scrollIntoView({behavior: 'smooth', block: 'center'});
                    openDetailModal(autoOpenCard);
                }
            }
        }
    };
});
