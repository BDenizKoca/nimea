---
layout: base.njk
title: Wiki
lang: en
permalink: /en/wiki/
---

# Nimea Wiki

This wiki contains records of people, places, nations, beliefs and events in the world of Nimea. You can navigate to any section from the links below.

## Recent Entries

{% assign enAll = collections.charactersEn | concat: collections.playerCharactersEn | concat: collections.locationsEn | concat: collections.nationsEn | concat: collections.godsEn | concat: collections.magicEn %}
{% assign trAll = collections.characters | concat: collections.playerCharacters | concat: collections.locations | concat: collections.nations | concat: collections.gods | concat: collections.magic %}
{% assign recentEn = enAll | sort: 'date' | reverse | slice: 0, 5 %}
{% if recentEn.size == 0 %}
	{% assign recentEn = trAll | sort: 'date' | reverse | slice: 0, 5 %}
{% endif %}

{% for entry in recentEn %}
* [{{ entry.data.name }}]({{ entry.url }}) - {{ entry.data.summary }}
{% endfor %}

{% if recentEn.size == 0 %}
*No entries yet.*
{% endif %}

## Categories

### People & Characters
* [Player Characters](/en/wiki/player-characters/) - The adventuring heroes and their stories
* [NPCs & Characters](/en/wiki/characters/) - Important figures and personalities

### World & Geography
* [Locations & Regions](/en/wiki/locations-regions/) - Cities, kingdoms, landmarks and geographical features

### Politics & Society
* [Nations & Factions](/en/wiki/nations-factions/) - Kingdoms, empires, organizations and political entities

### Mysticism & Beliefs  
* [Gods & Religions](/en/wiki/gods-religions/) - Deities, faiths, and religious practices
* [Magic & Powers](/en/wiki/magic-powers/) - Magical systems, artifacts and supernatural abilities

---

[Türkçe için buraya tıklayın](/wiki/)