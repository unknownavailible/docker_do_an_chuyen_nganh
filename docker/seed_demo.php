<?php
// Run in the Moodle container: php /tmp/seed_demo.php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/group/lib.php');

global $DB, $USER;
$admin = get_admin();
if (!$admin) {
    throw new moodle_exception('Admin account is required');
}
\core\session\manager::set_user($admin);

$shortname = 'KANBAN-DEMO-2026';
$course = $DB->get_record('course', ['shortname' => $shortname]);
if (!$course) {
    $course = create_course((object)[
        'fullname' => 'Dự án phần mềm - dữ liệu mẫu Kanban',
        'shortname' => $shortname,
        'category' => 1,
        'format' => 'topics',
        'visible' => 1,
        'groupmode' => SEPARATEGROUPS,
        'groupmodeforce' => 0,
    ]);
}

$people = [
    ['kb_demo_teacher', 'Giảng', 'Nguyễn Văn', 'editingteacher', null],
    ['kb_demo_an', 'An', 'Trần Minh', 'student', 'Nhóm 01'],
    ['kb_demo_binh', 'Bình', 'Lê Hoàng', 'student', 'Nhóm 01'],
    ['kb_demo_chi', 'Chi', 'Phạm Thu', 'student', 'Nhóm 01'],
    ['kb_demo_dung', 'Dũng', 'Võ Anh', 'student', 'Nhóm 02'],
    ['kb_demo_ha', 'Hà', 'Đỗ Ngọc', 'student', 'Nhóm 02'],
    ['kb_demo_khanh', 'Khánh', 'Bùi Gia', 'student', 'Nhóm 02'],
];
$password = 'KanbanDemo@2026!';
$users = [];
$manual = enrol_get_plugin('manual');
$instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual'], '*', MUST_EXIST);
foreach ($people as [$username, $firstname, $lastname, $role, $groupname]) {
    $user = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id, 'deleted' => 0]);
    if (!$user) {
        $newuser = (object)[
            'username' => $username,
            'password' => $password,
            'firstname' => $firstname,
            'lastname' => $lastname,
            'email' => $username . '@example.com',
            'auth' => 'manual',
            'confirmed' => 1,
            'mnethostid' => $CFG->mnet_localhost_id,
        ];
        $newuser->id = user_create_user($newuser, true, false);
        $user = $newuser;
    }
    $users[$username] = $user;
    $roleid = $DB->get_field('role', 'id', ['shortname' => $role], MUST_EXIST);
    if (!$DB->record_exists('user_enrolments', ['enrolid' => $instance->id, 'userid' => $user->id])) {
        $manual->enrol_user($instance, $user->id, $roleid);
    }
}

$groups = [];
foreach (['Nhóm 01', 'Nhóm 02'] as $name) {
    $group = $DB->get_record('groups', ['courseid' => $course->id, 'name' => $name]);
    if (!$group) {
        $group = (object)['courseid' => $course->id, 'name' => $name, 'description' => 'Nhóm dữ liệu mẫu Kanban'];
        $group->id = groups_create_group($group);
    }
    $groups[$name] = $group;
}
foreach ($people as [$username, $firstname, $lastname, $role, $groupname]) {
    if ($groupname && !groups_is_member($groups[$groupname]->id, $users[$username]->id)) {
        groups_add_member($groups[$groupname]->id, $users[$username]->id);
    }
}

$boardname = 'Kanban đồ án - dữ liệu mẫu';
$board = $DB->get_record('kanban', ['course' => $course->id, 'name' => $boardname]);
if (!$board) {
    $module = (object)[
        'modulename' => 'kanban',
        'module' => $DB->get_field('modules', 'id', ['name' => 'kanban'], MUST_EXIST),
        'course' => $course->id,
        'section' => 0,
        'name' => $boardname,
        'intro' => 'Bảng mẫu để trình diễn và kiểm thử chức năng Kanban.',
        'introformat' => FORMAT_HTML,
        'visible' => 1,
        'groupmode' => SEPARATEGROUPS,
    ];
    add_moduleinfo($module, $course);
    $board = $DB->get_record('kanban', ['course' => $course->id, 'name' => $boardname], '*', MUST_EXIST);
}
$cm = get_coursemodule_from_instance('kanban', $board->id, $course->id, false, MUST_EXIST);
$columns = array_values($DB->get_records('kanban_columns', ['kanbanid' => $board->id], 'sortorder ASC'));
if (count($columns) < 3) {
    throw new moodle_exception('Expected three default Kanban columns');
}

$tasks = [
    'Phân tích yêu cầu', 'Lập kế hoạch sprint', 'Thiết kế cơ sở dữ liệu',
    'Vẽ sơ đồ use case', 'Thiết kế giao diện đăng nhập', 'Thiết kế giao diện Kanban',
    'Tạo chức năng đăng nhập', 'Tạo chức năng phân quyền', 'Xây dựng API khóa học',
    'Xây dựng API thẻ công việc', 'Tạo chức năng kéo thả thẻ', 'Thêm bộ lọc công việc',
    'Gửi thông báo hạn chót', 'Tải tệp đính kèm', 'Viết kiểm thử PHPUnit',
];
$membernames = [
    'Nhóm 01' => ['kb_demo_an', 'kb_demo_binh', 'kb_demo_chi'],
    'Nhóm 02' => ['kb_demo_dung', 'kb_demo_ha', 'kb_demo_khanh'],
];
$now = time();
foreach ($membernames as $groupname => $members) {
    foreach ($tasks as $index => $title) {
        $title = $groupname . ' - ' . $title;
        $existing = $DB->get_record('kanban_cards', ['kanbanid' => $board->id, 'groupid' => $groups[$groupname]->id, 'title' => $title]);
        if ($existing) {
            continue;
        }
        $columnindex = $index < 5 ? 0 : ($index < 10 ? 1 : 2);
        $assigned = $index % 7 === 0 ? 0 : $users[$members[$index % 3]]->id;
        $duedate = $index % 5 === 0 ? 0 : ($index % 6 === 0 ? $now - DAYSECS : ($index % 4 === 0 ? $now + DAYSECS : $now + ($index + 2) * DAYSECS));
        $cardid = $DB->insert_record('kanban_cards', (object)[
            'kanbanid' => $board->id,
            'columnid' => $columns[$columnindex]->id,
            'groupid' => $groups[$groupname]->id,
            'title' => $title,
            'description' => 'Dữ liệu mẫu cho ' . $groupname . ': ' . $tasks[$index],
            'assigned_to' => $assigned,
            'duedate' => $duedate,
            'priority' => ['high', 'medium', 'low'][$index % 3],
            'sortorder' => $index,
            'time_allocated' => 60 * (1 + $index % 5),
            'time_spent' => $columnindex === 2 ? 45 * (1 + $index % 5) : 0,
            'task_url' => $index % 5 === 2 ? 'https://example.com/demo-task' : '',
            'timecreated' => $now - ($index + 1) * DAYSECS,
            'timemodified' => $now,
        ]);
        if ($assigned) {
            $DB->insert_record('kanban_card_assignees', (object)['cardid' => $cardid, 'userid' => $assigned]);
        }
        if ($index % 4 === 1) {
            $DB->insert_record('kanban_card_comments', (object)[
                'cardid' => $cardid, 'userid' => $users['kb_demo_teacher']->id,
                'comment' => 'Giảng viên đã xem và góp ý cho công việc mẫu này.', 'timecreated' => $now,
            ]);
        }
    }
}

// Add examples with two assignees and a Moodle-managed attachment.
$storage = get_file_storage();
$context = context_module::instance($cm->id);
foreach ($membernames as $groupname => $members) {
    $shared = $DB->get_record('kanban_cards', [
        'kanbanid' => $board->id, 'groupid' => $groups[$groupname]->id,
        'title' => $groupname . ' - ' . $tasks[4],
    ], '*', MUST_EXIST);
    foreach ([$members[0], $members[1]] as $username) {
        $userid = $users[$username]->id;
        if (!$DB->record_exists('kanban_card_assignees', ['cardid' => $shared->id, 'userid' => $userid])) {
            $DB->insert_record('kanban_card_assignees', (object)['cardid' => $shared->id, 'userid' => $userid]);
        }
    }
    $attached = $DB->get_record('kanban_cards', [
        'kanbanid' => $board->id, 'groupid' => $groups[$groupname]->id,
        'title' => $groupname . ' - ' . $tasks[9],
    ], '*', MUST_EXIST);
    $filerecord = [
        'contextid' => $context->id, 'component' => 'mod_kanban',
        'filearea' => 'card_attachments', 'itemid' => $attached->id,
        'userid' => $users['kb_demo_teacher']->id, 'filepath' => '/',
        'filename' => 'yeu-cau-mau.txt',
    ];
    if (!$storage->file_exists($context->id, 'mod_kanban', 'card_attachments', $attached->id, '/', 'yeu-cau-mau.txt')) {
        $storage->create_file_from_string($filerecord, 'Tai lieu yeu cau mau cho ' . $groupname . PHP_EOL);
    }
}

echo 'Course: ' . (new moodle_url('/course/view.php', ['id' => $course->id]))->out(false) . PHP_EOL;
echo 'Board: ' . (new moodle_url('/mod/kanban/view.php', ['id' => $cm->id]))->out(false) . PHP_EOL;
echo 'Demo users: ' . implode(', ', array_keys($users)) . PHP_EOL;
echo 'Password for newly created demo users: ' . $password . PHP_EOL;
echo 'Cards: ' . $DB->count_records('kanban_cards', ['kanbanid' => $board->id]) . PHP_EOL;
