---
layout: base.njk
title: Nations & Factions
lang: en
permalink: /en/wiki/nations-factions/
---

# Nations & Factions

This section covers states, empires, organizations, and groups in Nimea.

## Major Nations

{% for nation in collections.nationsEn %}
- [{{ nation.data.name }}]({{ nation.url }}) - {{ nation.data.summary }}
{% endfor %}
