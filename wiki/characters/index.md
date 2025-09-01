---
layout: base.njk
title: Characters
---

# Characters

This section contains information about the notable NPCs in the world of Nimea.

## Notable Characters

{% for character in collections.characters %}
{%- if character.data.public %}
- [{{ character.data.name }}]({{ character.data.slug }}/) - {{ character.data.summary }}
{%- endif %}
{% endfor %}
