---
layout: base.njk
title: Külliyat
---

# Nimea Külliyatı

Bu külliyat Nimea dünyasına dair kişi, yer, devlet, inanç ve olay kayıtlarını içerir. Aşağıdaki başlıklardan dilediğin bölüme geçebilirsin.

## Kategoriler

* [Maceracılar](player-characters/) - Maceradaki oyuncu karakterleri
* [Karakterler](characters/) - Öne çıkan kişiler ve tarihî figürler
* [Uluslar ve Cemiyetler](nations-factions/) - Krallıklar, imparatorluklar, teşkilatlar ve siyasal yapılar
* [Mekânlar ve Bölgeler](locations-regions/) - Şehirler, harabeler, anıtlar ve coğrafyalar
* [Tanrılar ve İnançlar](gods-religions/) - İnanç toplulukları ve öğretiler
* [Büyü ve Kudretler](magic-powers/) - Büyü düzenleri, eserler ve olağanüstü hâller

## Son Kayıtlar

{% assign allEntries = collections.characters | concat: collections.playerCharacters | concat: collections.locations | concat: collections.nations | concat: collections.gods | concat: collections.magic %}
{% assign recentEntries = allEntries | sort: 'date' | reverse | slice: 0, 3 %}

{% for entry in recentEntries %}
* [{{ entry.data.name }}]({{ entry.url }}) - {{ entry.data.summary }}
{% endfor %}

{% if recentEntries.size == 0 %}
*Henüz kayıt yok. İçerik eklemek için [Yönetim Paneli](/admin/)ni kullan.*
{% endif %}
