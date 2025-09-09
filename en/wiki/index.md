---
layout: base.njk
title: Wiki
lang: en
permalink: /en/wiki/
---

# Nimea Wiki

This wiki contains records of people, places, nations, beliefs and events in the world of Nimea. Choose a section below.

## Categories

* [Player Characters](/en/wiki/player-characters/) - The adventuring heroes and their stories
* [NPCs & Characters](/en/wiki/characters/) - Important figures and personalities
* [Nations & Factions](/en/wiki/nations-factions/) - Kingdoms, empires, organizations and political entities
* [Locations & Regions](/en/wiki/locations-regions/) - Cities, kingdoms, landmarks and geographical features
* [Gods & Religions](/en/wiki/gods-religions/) - Deities, faiths, and religious practices
* [Magic & Powers](/en/wiki/magic-powers/) - Magical systems, artifacts and supernatural abilities

---

[Türkçe için buraya tıklayın](/wiki/)

## Recent Entries

{% assign recentEn = collections.charactersEn
	| concat: collections.playerCharactersEn
	| concat: collections.locationsEn
	| concat: collections.nationsEn
	| concat: collections.godsEn
	| concat: collections.magicEn %}
{% assign recentEn = recentEn | sort: 'date' | reverse | slice: 0, 3 %}

{% for entry in recentEn %}
* [{{ entry.data.name }}]({{ entry.url }}) - {{ entry.data.summary }}
{% endfor %}

{% if recentEn.size == 0 %}
*No entries yet.*
{% endif %}