---
layout: base.njk
title: Gods & Religions
---

# Gods & Religions

This section contains information about the deities, religions, and belief systems of Nimea.

{% if collections.gods_religions %}
## Deities & Belief Systems

{% for item in collections.gods_religions %}
- [{{ item.data.name }}]({{ item.url }}) - {{ item.data.summary }}
{% endfor %}
{% endif %}
