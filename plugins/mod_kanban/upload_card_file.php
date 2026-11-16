<?php
require_once(__DIR__ . '/../../config.php');
require_once(__DIR__ . '/lib.php');

header('Content-Type: application/json; charset=utf-8');

$cmid = required_param('cmid', PARAM_INT);
$cardid = required_param('cardid', PARAM_INT);
$kind = required_param('kind', PARAM_ALPHA);

$cm = get_coursemodule_from_id('kanban', $cmid, 0, false, MUST_EXIST);
$course = get_course($cm->course);
require_login($course, false, $cm);
require_sesskey();
$context = context_module::instance($cm->id);
$kanban = $DB->get_record('kanban', ['id' => $cm->instance], '*', MUST_EXIST);
$card = kanban_validate_and_get_card($cardid, $cm, $kanban, 'mod/kanban:updateprogress');

if ($kind === 'task') {
    require_capability('mod/kanban:managecards', $context);
    $filearea = 'card_attachments';
} else if ($kind === 'submission' && kanban_can_update_card_progress($card, $cm, $context)) {
    $filearea = 'submission_files';
} else {
    throw new required_capability_exception($context, 'mod/kanban:updateprogress', 'nopermissions', '');
}

foreach ($_FILES as $upload) {
    $errors = is_array($upload['error'] ?? null) ? $upload['error'] : [$upload['error'] ?? UPLOAD_ERR_NO_FILE];
    foreach ($errors as $error) {
        if (!in_array((int)$error, [UPLOAD_ERR_OK, UPLOAD_ERR_NO_FILE], true)) {
            echo json_encode(['status' => false, 'message' => get_string('error_upload_failed', 'mod_kanban', (int)$error)]);
            exit;
        }
    }
}

$saved = kanban_save_card_attachments($card->id, $cm, $_FILES, $filearea);
if (!$saved) {
    echo json_encode(['status' => false, 'message' => get_string('error_upload_empty', 'mod_kanban')]);
    exit;
}
$DB->set_field('kanban_cards', 'timemodified', time(), ['id' => $card->id]);
kanban_log_card_change($card->id, 'fileadded', get_string('history_file_added', 'mod_kanban'));
echo json_encode(['status' => true, 'files' => $saved, 'message' => get_string('msg_file_uploaded', 'mod_kanban')]);
