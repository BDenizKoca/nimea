---
layout: base.njk
title: Gods & Religions
---

# Gods & Religions

This section contains information about the deities, religions, and belief systems of Nimea.

{% if collections.gods %}
## Deities & Belief Systems

{% for item in collections.gods %}
- [{{ item.data.name }}]({{ item.url }}) - {{ item.data.summary }}
{% endfor %}
{% endif %}
