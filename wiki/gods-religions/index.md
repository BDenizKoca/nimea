---
layout: base.njk
title: Tanrılar ve İnançlar
type: hub
summary: Nimea’daki inanç topluluklarını, öğretileri ve tanrıları keşfedin.
cover_image: 
---

# Tanrılar ve İnançlar

Bu bölüm Nimea’daki inanç topluluklarını ve öğretileri içerir.

{% if collections.gods %}
{% assign sorted = collections.gods | sort: 'data.name' %}
## İnanç Toplulukları ve Öğretiler

{% for item in sorted %}
- [{{ item.data.name }}]({{ item.url }}) - {{ item.data.summary }}
{% endfor %}
{% endif %}
