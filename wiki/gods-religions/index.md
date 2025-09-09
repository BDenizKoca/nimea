---
layout: base.njk
title: Tanrılar ve İnançlar
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
