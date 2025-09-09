---
layout: base.njk
name: Tanrılar ve İnançlar
slug: gods-religions
summary: Nimea’daki inanç topluluklarını, öğretileri ve tanrıları keşfedin.
cover_image: https://www.notion.so/image/attachment%3Ae4188ddf-56b5-43ec-981b-0e6c5791d8fe%3AChatGPT_Image_11_May_2025_02_33_48.png?table=block&id=1e161baa-cdf2-81b7-9a7d-edd3ca5ae05d&spaceId=76a03756-5517-4bba-9e67-a94713d611fd&width=2000&userId=1dfd872b-594c-8111-80ff-00027e154fa6&cache=v2
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
