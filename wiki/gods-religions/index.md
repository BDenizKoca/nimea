---
layout: base.njk
name: Tanrılar ve İnançlar
slug: gods-religions
summary: Nimea’daki inanç topluluklarını, öğretileri ve tanrıları keşfedin.
cover_image: https://file.garden/aLboplo8eB2dIZKp/Nimea/religioncover.png
public: true
title: Tanrılar ve İnançlar
type: hub
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
