---
layout: base.njk
title: Locations & Regions
lang: en
permalink: /en/wiki/locations-regions/
---

# Locations & Regions

This section includes cities, dungeons, landmarks, and geographies across Nimea.

## Featured Locations

{% for location in collections.locationsEn %}
- [{{ location.data.name }}]({{ location.url }}) - {{ location.data.summary }}
{% endfor %}
