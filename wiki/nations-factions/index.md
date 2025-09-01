---
layout: base.njk
title: Nations & Factions
---

# Nations & Factions

This section contains information about the various nations, empires, and organizations in Nimea.

## Major Nations

{% for nation in collections.nations_factions %}
- [{{ nation.data.name }}]({{ nation.url }}) - {{ nation.data.summary }}
{% endfor %}
