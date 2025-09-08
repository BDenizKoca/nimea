---
layout: base.njk
title: Player Characters
lang: en
permalink: /en/wiki/player-characters/
---

# Player Characters

Adventuring heroes and their stories.

## Party Members

{% for pc in collections.playerCharactersEn %}
- [{{ pc.data.name }}]({{ pc.url }}) - {{ pc.data.summary }}
{% endfor %}
