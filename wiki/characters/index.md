---
layout: base.njk
title: Karakterler
name: Karakterler
slug: characters
summary: Nimea dünyasındaki öne çıkan kişiler ve anlatıda yer alan karakterler.
cover_image: /images/chatgpt_image_11_may_2025_02_44_04.png
public: true
---

# Karakterler

Bu bölüm Nimea’daki öne çıkan kişileri ve anlatıda yer alan karakterleri içerir.

## Öne Çıkanlar

{% for character in collections.characters %}
{%- if character.data.public %}
- [{{ character.data.name }}]({{ character.data.slug }}/) - {{ character.data.summary }}
{%- endif %}
{% endfor %}
