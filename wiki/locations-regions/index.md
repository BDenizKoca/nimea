---
layout: base.njk
title: Mekânlar ve Bölgeler
---

# Mekânlar ve Bölgeler

Bu bölüm Nimea’daki şehirleri, zindanları, anıtları ve coğrafyaları içerir.

## Öne Çıkan Mekânlar

{% for location in collections.locations %}
- [{{ location.data.name }}]({{ location.url }}) - {{ location.data.summary }}
{% endfor %}
