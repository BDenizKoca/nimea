---
layout: base.njk
title: Ana Sayfa
lang: tr
---

# Nimea Evreni Külliyatına hoş geldiniz

Bu site Nimea dünyasına açılan kapıdır. Ülkeler, kişiler, yerler ve kayıtlı olaylar burada tutulur.

Seçenekler:

* [Etkileşimli Harita](map/)
* [Külliyat (Wiki)](wiki/)

---

[Click here for English](/en/)

---

<div class="entry-actions btn-row" style="justify-content:center; margin-top: 1rem;">
	<a href="#" id="home-admin-cta" class="btn btn--accent">Yönetim / Giriş</a>
	<script>
		document.addEventListener('DOMContentLoaded', () => {
			const cta = document.getElementById('home-admin-cta');
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
