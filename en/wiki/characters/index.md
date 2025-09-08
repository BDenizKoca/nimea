---
layout: base.njk
title: Characters
name: Characters
slug: characters
lang: en
summary: Notable people and figures in the world of Nimea.
public: true
permalink: /en/wiki/characters/
---

# Characters

This section lists notable people and figures in Nimea.

## Featured

{% for character in collections.charactersEn %}
{%- if character.data.public %}
- [{{ character.data.name }}]({{ character.url }}) - {{ character.data.summary }}
{%- endif %}
{% endfor %}
