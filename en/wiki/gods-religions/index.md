---
layout: base.njk
title: Gods & Religions
lang: en
permalink: /en/wiki/gods-religions/
---

# Gods & Religions

Deities, faiths, and religious practices across Nimea.

## Pantheon

{% for god in collections.godsEn %}
- [{{ god.data.name }}]({{ god.url }}) - {{ god.data.summary }}
{% endfor %}
