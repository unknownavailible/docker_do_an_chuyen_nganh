<?php

unset($CFG);
global $CFG;
$CFG = new stdClass();

$CFG->dbtype = 'mariadb';
$CFG->dblibrary = 'native';
$CFG->dbhost = getenv('MOODLE_DB_HOST') ?: 'db';
$CFG->dbname = getenv('MOODLE_DB_NAME') ?: 'moodle';
$CFG->dbuser = getenv('MOODLE_DB_USER') ?: 'moodle';
$CFG->dbpass = getenv('MOODLE_DB_PASSWORD') ?: '';
$CFG->prefix = 'mdl_';
$CFG->dboptions = [
    'dbpersist' => 0,
    'dbport' => '3306',
    'dbsocket' => '',
    'dbcollation' => 'utf8mb4_unicode_ci',
];

$CFG->wwwroot = getenv('MOODLE_WWWROOT') ?: 'http://localhost:8080';
$CFG->dataroot = '/var/moodledata';
$CFG->admin = 'admin';
$CFG->directorypermissions = 02777;

$CFG->phpunit_dataroot = '/var/moodledata_phpunit';
$CFG->phpunit_prefix = 'phpu_';
$CFG->behat_wwwroot = 'http://moodle';
$CFG->behat_dataroot = '/var/moodledata_behat';
$CFG->behat_prefix = 'behat_';
$CFG->behat_profiles = [
    'chrome' => [
        'browser' => 'chrome',
        'wd_host' => 'http://selenium:4444/wd/hub',
    ],
];

require_once(__DIR__ . '/lib/setup.php');
