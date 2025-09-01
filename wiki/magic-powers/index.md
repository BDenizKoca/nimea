---
layout: base.njk
title: Magic & Powers
---

# Magic & Powers

This section contains information about the magical systems, artifacts, and supernatural powers present in Nimea.

{% if collections.magic_powers %}
## Magical Systems & Artifacts

{% for item in collections.magic_powers %}
- [{{ item.data.name }}]({{ item.url }}) - {{ item.data.summary }}
{% endfor %}
{% endif %}
