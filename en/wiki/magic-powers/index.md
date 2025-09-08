---
layout: base.njk
title: Magic & Powers
lang: en
permalink: /en/wiki/magic-powers/
---

# Magic & Powers

Magical systems, artifacts and supernatural abilities.

## Topics

{% for m in collections.magicEn %}
- [{{ m.data.name }}]({{ m.url }}) - {{ m.data.summary }}
{% endfor %}
