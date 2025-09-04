---
layout: base.njk
title: Büyü ve Kudretler
---

# Büyü ve Kudretler

Bu bölüm Nimea’daki büyü düzenlerini, eserleri ve olağanüstü hâlleri içerir.

{% if collections.magic %}
## Büyü Düzenleri ve Eserler

{% for item in collections.magic %}
- [{{ item.data.name }}]({{ item.url }}) - {{ item.data.summary }}
{% endfor %}
{% endif %}
