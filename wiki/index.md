---
layout: base.njk
title: Wiki
---

# Welcome to the Nimea Wiki

This wiki contains all the information about the world of Nimea, its inhabitants, geography, history, and lore. Use the categories below to navigate through different sections of the wiki.

## Recent Entries

{% assign allEntries = collections.characters | concat: collections.player_characters | concat: collections.locations_regions | concat: collections.nations_factions | concat: collections.gods_religions | concat: collections.magic_powers %}
{% assign recentEntries = allEntries | sort: 'date' | reverse | slice: 0, 5 %}

{% for entry in recentEntries %}
* [{{ entry.data.name }}]({{ entry.url }}) - {{ entry.data.summary }}
{% endfor %}

{% if recentEntries.size == 0 %}
*No entries yet. Start creating content through the [Admin Panel](/admin/)!*
{% endif %}

## Wiki Categories

*   [Player Characters](player-characters/) - Information about player characters in the campaign
*   [Characters](characters/) - Notable NPCs and historical figures
*   [Nations & Factions](nations-factions/) - Kingdoms, empires, organizations, and political groups
*   [Locations & Regions](locations-regions/) - Cities, dungeons, landmarks, and geographical regions
*   [Gods & Religions](gods-religions/) - Deities, religious organizations, and belief systems
*   [Magic & Powers](magic-powers/) - Magic systems, artifacts, and supernatural phenomena
