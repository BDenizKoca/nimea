---
layout: base.njk
title: Maceracılar
---

# Maceracılar

Bu bölüm maceradaki oyuncu karakterlerini içerir.

{% if collections.playerCharacters %}
## Şimdiki Kadro

{% for character in collections.playerCharacters %}
- [{{ character.data.name }}]({{ character.url }}) - {{ character.data.summary }}
{% endfor %}
{% endif %}
