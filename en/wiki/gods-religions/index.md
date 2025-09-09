---
layout: base.njk
title: Gods & Religions
lang: en
permalink: /en/wiki/gods-religions/
---

# Gods & Religions

Deities, faiths, and religious practices across Nimea.

## Pantheon

{% assign sorted = collections.godsEn | sort: 'data.name' %}
{% for god in sorted %}
- [{{ god.data.name }}]({{ god.url }}) - {{ god.data.summary }}
{% endfor %}
