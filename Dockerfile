FROM php:8.2-apache

ENV MOODLE_DOCKER=1
ARG MOODLE_VERSION=4.3.12

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        libcurl4-openssl-dev \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libonig-dev \
        libpng-dev \
        libxml2-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" curl gd intl mbstring mysqli opcache soap zip \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://download.moodle.org/download.php/direct/stable403/moodle-${MOODLE_VERSION}.tgz" -o /tmp/moodle.tgz \
    && tar -xzf /tmp/moodle.tgz --strip-components=1 -C /var/www/html \
    && rm /tmp/moodle.tgz

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
RUN COMPOSER_ALLOW_SUPERUSER=1 composer install --working-dir=/var/www/html \
    --prefer-dist --no-interaction --no-progress --optimize-autoloader

RUN apt-get update \
    && apt-get install -y --no-install-recommends locales \
    && echo 'en_AU.UTF-8 UTF-8' > /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=www-data:www-data plugins/mod_kanban/ /var/www/html/mod/kanban/
COPY --chown=www-data:www-data plugins/block_buttonkb/ /var/www/html/blocks/buttonkb/
COPY --chown=www-data:www-data docker/config.php /var/www/html/config.php
COPY docker/php.ini /usr/local/etc/php/conf.d/moodle.ini

RUN mkdir -p /var/moodledata /var/moodledata_phpunit /var/moodledata_behat \
    && chown -R www-data:www-data /var/moodledata /var/moodledata_phpunit /var/moodledata_behat

