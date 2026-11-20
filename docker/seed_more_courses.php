<?php
// Copy to /tmp/seed_more_courses.php in the Moodle container and run with php.
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/group/lib.php');

global $DB;
\core\session\manager::set_user(get_admin());
$password = 'KanbanDemo@2026!';
$manual = enrol_get_plugin('manual');
$roleids = [
    'student' => $DB->get_field('role', 'id', ['shortname' => 'student'], MUST_EXIST),
    'editingteacher' => $DB->get_field('role', 'id', ['shortname' => 'editingteacher'], MUST_EXIST),
];

function demo_more_user(string $username, string $firstname, string $lastname, string $password): stdClass {
    global $DB, $CFG;
    $user = $DB->get_record('user', [
        'username' => $username, 'mnethostid' => $CFG->mnet_localhost_id, 'deleted' => 0,
    ]);
    if ($user) {
        return $user;
    }
    $user = (object)[
        'username' => $username, 'password' => $password,
        'firstname' => $firstname, 'lastname' => $lastname,
        'email' => $username . '@example.com', 'auth' => 'manual',
        'confirmed' => 1, 'mnethostid' => $CFG->mnet_localhost_id,
    ];
    $user->id = user_create_user($user, true, false);
    return $user;
}

$teachers = [];
$students = [];
for ($i = 1; $i <= 6; $i++) {
    $n = sprintf('%02d', $i);
    $teachers[$i] = demo_more_user('kb_demo_gv' . $n, 'Giảng viên ' . $n, 'Mẫu', $password);
}
for ($i = 1; $i <= 36; $i++) {
    $n = sprintf('%02d', $i);
    $students[$i] = demo_more_user('kb_demo_sv' . $n, 'Sinh viên ' . $n, 'Mẫu', $password);
}

$themes = [
    'Phân tích và thiết kế hệ thống', 'Lập trình web', 'Cơ sở dữ liệu',
    'Kiểm thử phần mềm', 'Quản lý dự án phần mềm', 'Phát triển ứng dụng di động',
    'Lập trình hướng đối tượng', 'Thiết kế giao diện người dùng',
    'Điện toán đám mây', 'An toàn thông tin', 'Tích hợp hệ thống', 'Đồ án chuyên ngành',
];
$created = [];
foreach ($themes as $offset => $theme) {
    $number = $offset + 1;
    $code = sprintf('KB-DEMO-%02d', $number);
    $course = $DB->get_record('course', ['shortname' => $code]);
    if (!$course) {
        $course = create_course((object)[
            'fullname' => $theme . ' - Khóa học mẫu ' . $number,
            'shortname' => $code, 'category' => 1, 'format' => 'topics',
            'visible' => 1, 'groupmode' => SEPARATEGROUPS, 'groupmodeforce' => 0,
        ]);
    }
    $enrol = $DB->get_record('enrol', [
        'courseid' => $course->id, 'enrol' => 'manual',
    ], '*', MUST_EXIST);
    $teacherids = [($offset % 6) + 1, (($offset + 1) % 6) + 1];
    foreach ($teacherids as $teacherindex) {
        $teacher = $teachers[$teacherindex];
        if (!$DB->record_exists('user_enrolments', ['enrolid' => $enrol->id, 'userid' => $teacher->id])) {
            $manual->enrol_user($enrol, $teacher->id, $roleids['editingteacher']);
        }
    }
    $groups = [];
    for ($g = 1; $g <= 3; $g++) {
        $name = sprintf('Nhóm %02d', $g);
        $group = $DB->get_record('groups', ['courseid' => $course->id, 'name' => $name]);
        if (!$group) {
            $group = (object)[
                'courseid' => $course->id, 'name' => $name,
                'description' => 'Nhóm ' . $g . ' của khóa học ' . $code,
            ];
            $group->id = groups_create_group($group);
        }
        $groups[$g] = $group;
        for ($slot = 0; $slot < 4; $slot++) {
            $position = ($g - 1) * 4 + $slot;
            $studentindex = (($offset * 3 + $position) % 36) + 1;
            $student = $students[$studentindex];
            if (!$DB->record_exists('user_enrolments', ['enrolid' => $enrol->id, 'userid' => $student->id])) {
                $manual->enrol_user($enrol, $student->id, $roleids['student']);
            }
            if (!groups_is_member($group->id, $student->id)) {
                groups_add_member($group->id, $student->id);
            }
        }
    }

    $boardname = 'Kanban ' . $code;
    $board = $DB->get_record('kanban', ['course' => $course->id, 'name' => $boardname]);
    if (!$board) {
        add_moduleinfo((object)[
            'modulename' => 'kanban',
            'module' => $DB->get_field('modules', 'id', ['name' => 'kanban'], MUST_EXIST),
            'course' => $course->id, 'section' => 0, 'name' => $boardname,
            'intro' => 'Bảng công việc mẫu của ' . $theme,
            'introformat' => FORMAT_HTML, 'visible' => 1, 'groupmode' => SEPARATEGROUPS,
        ], $course);
        $board = $DB->get_record('kanban', ['course' => $course->id, 'name' => $boardname], '*', MUST_EXIST);
    }
    $columns = array_values($DB->get_records('kanban_columns', ['kanbanid' => $board->id], 'sortorder ASC'));
    if (count($columns) < 3) {
        throw new moodle_exception('Three Kanban columns required');
    }
    foreach ($groups as $groupnumber => $group) {
        foreach (['Lập kế hoạch', 'Thực hiện chức năng', 'Rà soát kết quả'] as $columnindex => $task) {
            $title = $code . ' - Nhóm ' . $groupnumber . ' - ' . $task;
            if ($DB->record_exists('kanban_cards', ['kanbanid' => $board->id, 'title' => $title])) {
                continue;
            }
            $studentindex = (($offset * 3 + ($groupnumber - 1) * 4 + $columnindex) % 36) + 1;
            $student = $students[$studentindex];
            $cardid = $DB->insert_record('kanban_cards', (object)[
                'kanbanid' => $board->id, 'columnid' => $columns[$columnindex]->id,
                'groupid' => $group->id, 'title' => $title,
                'description' => 'Công việc mẫu cho ' . $theme,
                'assigned_to' => $student->id,
                'duedate' => time() + ($columnindex + 2) * DAYSECS,
                'priority' => ['high', 'medium', 'low'][$columnindex],
                'sortorder' => $groupnumber, 'time_allocated' => 120,
                'time_spent' => $columnindex === 2 ? 90 : 0,
                'timecreated' => time(), 'timemodified' => time(),
            ]);
            $DB->insert_record('kanban_card_assignees', (object)[
                'cardid' => $cardid, 'userid' => $student->id,
            ]);
        }
    }
    $cm = get_coursemodule_from_instance('kanban', $board->id, $course->id, false, MUST_EXIST);
    $created[] = $code . ' course=' . $course->id . ' board=' . $cm->id .
        ' groups=' . count($groups) . ' cards=' . $DB->count_records('kanban_cards', ['kanbanid' => $board->id]);
}
echo implode(PHP_EOL, $created) . PHP_EOL;
echo 'Accounts: kb_demo_gv01..06, kb_demo_sv01..36' . PHP_EOL;
echo 'Password for newly created accounts: ' . $password . PHP_EOL;
