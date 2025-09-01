---
layout: base.njk
title: Player Characters
---

# Player Characters

This section contains information about the player characters in the campaign.

{% if collections.playerCharacters %}
## Current Player Characters

{% for character in collections.playerCharacters %}
- [{{ character.data.name }}]({{ character.url }}) - {{ character.data.summary }}
{% endfor %}
{% endif %}
