---
layout: base.njk
title: Characters
name: Characters
slug: characters
summary: This section contains information about the notable NPCs in the world of Nimea.
cover_image: /images/chatgpt_image_11_may_2025_02_44_04.png
public: true
---

# Characters

This section contains information about the notable NPCs in the world of Nimea.

## Notable Characters

{% for character in collections.characters %}
{%- if character.data.public %}
- [{{ character.data.name }}]({{ character.data.slug }}/) - {{ character.data.summary }}
{%- endif %}
{% endfor %}
