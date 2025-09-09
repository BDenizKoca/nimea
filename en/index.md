---
layout: base.njk
title: Home
lang: en
permalink: /en/
---

# Welcome to the Nimea Universe Wiki

This is the complete archive of the fantasy realm of Nimea, containing characters, locations, nations, beliefs, and historical events.

## Navigation

* [Interactive Map](/en/map/)
* [Wiki](/en/wiki/)

---

[Türkçe için buraya tıklayın](/)

---

<div class="entry-actions btn-row" style="justify-content:center; margin-top: 1rem;">
	<a href="#" id="home-admin-cta-en" class="btn btn--accent">Admin / Login</a>
	<script>
		document.addEventListener('DOMContentLoaded', () => {
			const cta = document.getElementById('home-admin-cta-en');
			if (!cta) return;
			cta.addEventListener('click', (e) => {
				e.preventDefault();
				if (window.netlifyIdentity && typeof window.netlifyIdentity.currentUser === 'function') {
					const user = window.netlifyIdentity.currentUser();
					if (user) {
						window.location.assign('/admin/');
					} else {
						window.netlifyIdentity.open();
						const onLogin = () => { window.location.assign('/admin/'); window.netlifyIdentity.off('login', onLogin); };
						window.netlifyIdentity.on('login', onLogin);
					}
				} else {
					window.location.assign('/admin/');
				}
			});
		});
	</script>
</div>