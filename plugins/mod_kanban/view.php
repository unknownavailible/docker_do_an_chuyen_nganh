<?php
require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

$id = required_param('id', PARAM_INT);
$requestedcardid = optional_param('cardid', 0, PARAM_INT);

$cm = get_coursemodule_from_id('kanban', $id, 0, false, MUST_EXIST);
$course = $DB->get_record('course', ['id' => $cm->course], '*', MUST_EXIST);
$kanban = $DB->get_record('kanban', ['id' => $cm->instance], '*', MUST_EXIST);
$creator = !empty($kanban->creatorid) ? $DB->get_record('user', ['id' => $kanban->creatorid]) : false;

require_login($course, true, $cm);
$context = context_module::instance($cm->id);
require_capability('mod/kanban:view', $context);
kanban_require_single_group_membership($cm);

$PAGE->set_url('/mod/kanban/view.php', ['id' => $cm->id]);
$PAGE->set_title(format_string($kanban->name));
$PAGE->set_heading(format_string($course->fullname));
$PAGE->set_context($context);
$PAGE->requires->css(new moodle_url('/mod/kanban/styles.css', ['v' => '2026111904']));

$currentgroup = groups_get_activity_group($cm, true);
$autopencardid = 0;
if ($requestedcardid) {
    $requestedcard = $DB->get_record('kanban_cards', [
        'id' => $requestedcardid,
        'kanbanid' => $kanban->id,
    ]);
    if ($requestedcard && kanban_user_has_group_access($cm, $requestedcard->groupid, $context) &&
            (!$currentgroup || (int)$requestedcard->groupid === (int)$currentgroup)) {
        $autopencardid = (int)$requestedcard->id;
    }
}
$columns = $DB->get_records('kanban_columns', ['kanbanid' => $kanban->id], 'sortorder ASC');

// Cột cuối cùng (thường là Done)
$donecol = end($columns);
$donecolid = $donecol ? $donecol->id : 0;

$column_data = [];
foreach ($columns as $col) {
    $params = ['kanbanid' => $kanban->id, 'columnid' => $col->id];
    if ($currentgroup) {
        $params['groupid'] = $currentgroup;
    }
    
    $cards = $DB->get_records('kanban_cards', $params, 'sortorder ASC');
    $comments_table_exists = $DB->get_manager()->table_exists('kanban_card_comments');
    $card_list = [];
    foreach ($cards as $card) {
        // Kiểm tra trễ hạn và sắp đến hạn
        $is_done = ($card->columnid == $donecolid);
        $is_overdue = (!$is_done && $card->duedate > 0 && $card->duedate < time());
        $is_due_soon = (!$is_done && !$is_overdue && $card->duedate > 0 && $card->duedate <= (time() + 86400 * 2)); // trong 48h
        $has_feedback = $comments_table_exists && $DB->count_records('kanban_card_comments', ['cardid' => $card->id]) > 0;
        $commentcount = $comments_table_exists ? $DB->count_records('kanban_card_comments', ['cardid' => $card->id]) : 0;
        $fs = get_file_storage();
        $attachmentcount = count($fs->get_area_files($context->id, 'mod_kanban', 'card_attachments', $card->id, 'id', false)) +
            count($fs->get_area_files($context->id, 'mod_kanban', 'submission_files', $card->id, 'id', false));
        $assigneenames = kanban_get_card_assignee_names($card->id);
        $assigneeids = kanban_get_card_assignee_ids($card->id);
        $groupname = $card->groupid ? groups_get_group_name($card->groupid) : '';
        $cardcreator = !empty($card->creatorid) ? $DB->get_record('user', ['id' => $card->creatorid]) : false;

        $card_list[] = [
            'id' => $card->id,
            'column_title' => format_string($col->title),
            'title' => format_string($card->title),
            'title_raw' => $card->title,
            'description' => format_text($card->description, FORMAT_MOODLE),
            'description_raw' => $card->description ?? '',
            'group_name' => $groupname ?: '',
            'assignee_names' => $assigneenames,
            'assignee_ids' => implode(',', $assigneeids),
            'duedate_raw' => (int)($card->duedate ?? 0),
            'duedate_formatted' => $card->duedate ? userdate($card->duedate, '%d/%m/%Y %H:%M') : null,
            'is_overdue' => $is_overdue,
            'is_due_soon' => $is_due_soon,
            'has_feedback' => $has_feedback,
            'comment_count' => $commentcount,
            'attachment_count' => $attachmentcount,
            'has_comments' => $commentcount > 0,
            'has_attachments' => $attachmentcount > 0,
            'priority' => $card->priority ?? 'medium',
            'priority_high' => ($card->priority ?? 'medium') === 'high',
            'priority_medium' => ($card->priority ?? 'medium') === 'medium',
            'priority_low' => ($card->priority ?? 'medium') === 'low',
            'is_mine' => in_array((int)$USER->id, $assigneeids, true),
            'is_unassigned' => empty($assigneeids),
            'taskurl' => $card->task_url ?? '',
            'submissionurl' => $card->submission_url ?? '',
            'workflow_state' => $card->workflow_state ?? 'notstarted',
            'creator_name' => $cardcreator ? fullname($cardcreator) : get_string('unknowncreator', 'mod_kanban'),
            'timecreated_formatted' => userdate($card->timecreated),
            'timemodified_formatted' => userdate($card->timemodified),
        ];
    }

    $column_data[] = [
        'id' => $col->id,
        'title' => format_string($col->title),
        'color' => $col->color,
        'description' => format_text($col->description ?? '', FORMAT_PLAIN),
        'card_count' => count($card_list),
        'wip_limit' => $col->wip_limit,
        'has_cards' => !empty($card_list),
        'cards' => $card_list
    ];
}

$linkedassignment = kanban_get_linked_assignment_info($kanban);
$assignmentcontext = null;
if ($linkedassignment) {
    $assignmentcontext = [
        'name' => $linkedassignment['name'],
        'url' => $linkedassignment['url'],
        'duedate_formatted' => $linkedassignment['duedate']
            ? userdate($linkedassignment['duedate'], '%d/%m/%Y %H:%M') : null,
    ];
}

$templatecontext = [
    'cmid' => $cm->id,
    'kanbanid' => $kanban->id,
    'kanbanname' => format_string($kanban->name),
    'linkedassignment' => $assignmentcontext,
    'creatorname' => $creator ? fullname($creator) : get_string('unknowncreator', 'mod_kanban'),
    'intro' => format_module_intro('kanban', $kanban, $cm->id),
    'can_manage' => has_capability('mod/kanban:managecards', $context),
    'can_update_progress' => has_capability('mod/kanban:updateprogress', $context),
    'can_manage_columns' => has_capability('mod/kanban:managecolumns', $context) ||
        has_capability('mod/kanban:viewdashboard', $context),
    'can_view_dashboard' => has_capability('mod/kanban:viewdashboard', $context),
    'is_teacher_view' => has_capability('mod/kanban:managecards', $context),
    'dashboard_url' => (new moodle_url('/mod/kanban/dashboard.php', ['id' => $cm->id]))->out(),
    'assignee_members' => kanban_get_group_members_for_assignee_selection($cm),
    'first_column_id' => $column_data ? $column_data[0]['id'] : 0,
    'columns' => $column_data
];

// Preload every string used by amd/src/board.js so M.util.get_string() stays synchronous.
$PAGE->requires->strings_for_js([
    'loading', 'loadingattachments', 'nocomments', 'nohistory', 'activityloaderror',
    'nofiles', 'fileloaderror', 'deletefile', 'notitle', 'nodesc', 'overduealert',
    'duesoonalert', 'noduedate', 'unknown', 'errorgeneric', 'confirmdeletefile',
    'confirmdeletecard', 'columnnameprompt', 'columndescprompt', 'columncolorprompt',
    'columnwipprompt', 'confirmdeletecolumn', 'errornotjson', 'errorhttpcode',
    'required', 'error_duedate_past', 'dashboard_unassigned',
    'error_assignment_fields_required', 'submissionfile', 'taskfile', 'error_upload_empty',
    'revisioncommentrequired',
    'visiblecards',
], 'mod_kanban');
$PAGE->requires->js_call_amd('mod_kanban/board', 'init', [$cm->id, $kanban->id, $autopencardid, (int)$currentgroup]);

echo $OUTPUT->header();
groups_print_activity_menu($cm, $CFG->wwwroot . '/mod/kanban/view.php?id=' . $cm->id);
echo $OUTPUT->render_from_template('mod_kanban/board', $templatecontext);
echo $OUTPUT->footer();
