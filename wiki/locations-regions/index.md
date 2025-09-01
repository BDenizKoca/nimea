---
layout: base.njk
title: Locations & Regions
---

# Locations & Regions

This section contains information about the various locations, cities, dungeons, and geographical regions of Nimea.

## Notable Locations

{% for location in collections.locations_regions %}
- [{{ location.data.name }}]({{ location.url }}) - {{ location.data.summary }}
{% endfor %}
