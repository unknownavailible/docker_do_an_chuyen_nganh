FROM php:8.2-apache

ENV MOODLE_DOCKER=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libonig-dev \
        libpng-dev \
        libxml2-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" gd intl mbstring mysqli opcache soap zip \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=www-data:www-data . /var/www/html/
COPY --chown=www-data:www-data docker/config.php /var/www/html/config.php
COPY docker/php.ini /usr/local/etc/php/conf.d/moodle.ini

RUN mkdir -p /var/moodledata /var/moodledata_phpunit /var/moodledata_behat \
    && chown -R www-data:www-data /var/moodledata /var/moodledata_phpunit /var/moodledata_behat

