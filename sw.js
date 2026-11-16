/* AlQuran service worker — saves the whole app (page, Quran data, icons) and serves it cache-first,
   so AlQuran opens with no internet indefinitely. Every online launch the page asks it to check and
   repair the offline copy. A new build is detected when this file changes.
   Updates are patches: HASH holds a fingerprint of every file (written by swhash.py). When a new build
   installs, files whose saved copy already matches the fingerprint are copied from the previous offline
   copy on the phone; only changed files are downloaded. */
const BUILD = '20261116.072125';
const CACHE = 'alquran-' + BUILD;
const RUNTIME = 'alquran-runtime';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png', './data/ara-quranuthmanihaf.bin', './data/eng-muftitaqiusmani.bin', './data/eng-ummmuhammad.bin', './data/eng-abdullahyusufal.bin', './data/eng-mohammedmarmadu.bin', './data/fra-muhammadhamidul.bin', './data/deu-asfbubenheimand.bin', './data/ara-quran-la.bin', './data/ara-kingfahadquranc.bin', './data/ara-quransimple.bin', './data/ara-saddi.bin', './data/lat-hafs.bin', './data/deu-aburida.bin', './data/deu-rwwad.bin', './data/eng-mukhtasar.bin', './data/fra-mukhtasar.bin', './data/spa-mukhtasar.bin', './data/kur-mukhtasar.bin', './data/kur-rebar.bin', './data/kmr-ismail.bin', './data/spa-juliocortes.bin', './data/spa-muhammadisagarc.bin', './fonts/rb-serif.woff', './fonts/rb-naskh.woff', './data/wbw-en.bin', './data/tajweed.bin', './data/roots.json', './data/ibnkathir/001.bin', './data/ibnkathir/002.bin', './data/ibnkathir/003.bin', './data/ibnkathir/004.bin', './data/ibnkathir/005.bin', './data/ibnkathir/006.bin', './data/ibnkathir/007.bin', './data/ibnkathir/008.bin', './data/ibnkathir/009.bin', './data/ibnkathir/010.bin', './data/ibnkathir/011.bin', './data/ibnkathir/012.bin', './data/ibnkathir/013.bin', './data/ibnkathir/014.bin', './data/ibnkathir/015.bin', './data/ibnkathir/016.bin', './data/ibnkathir/017.bin', './data/ibnkathir/018.bin', './data/ibnkathir/019.bin', './data/ibnkathir/020.bin', './data/ibnkathir/021.bin', './data/ibnkathir/022.bin', './data/ibnkathir/023.bin', './data/ibnkathir/024.bin', './data/ibnkathir/025.bin', './data/ibnkathir/026.bin', './data/ibnkathir/027.bin', './data/ibnkathir/028.bin', './data/ibnkathir/029.bin', './data/ibnkathir/030.bin', './data/ibnkathir/031.bin', './data/ibnkathir/032.bin', './data/ibnkathir/033.bin', './data/ibnkathir/034.bin', './data/ibnkathir/035.bin', './data/ibnkathir/036.bin', './data/ibnkathir/037.bin', './data/ibnkathir/038.bin', './data/ibnkathir/039.bin', './data/ibnkathir/040.bin', './data/ibnkathir/041.bin', './data/ibnkathir/042.bin', './data/ibnkathir/043.bin', './data/ibnkathir/044.bin', './data/ibnkathir/045.bin', './data/ibnkathir/046.bin', './data/ibnkathir/047.bin', './data/ibnkathir/048.bin', './data/ibnkathir/049.bin', './data/ibnkathir/050.bin', './data/ibnkathir/051.bin', './data/ibnkathir/052.bin', './data/ibnkathir/053.bin', './data/ibnkathir/054.bin', './data/ibnkathir/055.bin', './data/ibnkathir/056.bin', './data/ibnkathir/057.bin', './data/ibnkathir/058.bin', './data/ibnkathir/059.bin', './data/ibnkathir/060.bin', './data/ibnkathir/061.bin', './data/ibnkathir/062.bin', './data/ibnkathir/063.bin', './data/ibnkathir/064.bin', './data/ibnkathir/065.bin', './data/ibnkathir/066.bin', './data/ibnkathir/067.bin', './data/ibnkathir/068.bin', './data/ibnkathir/069.bin', './data/ibnkathir/070.bin', './data/ibnkathir/071.bin', './data/ibnkathir/072.bin', './data/ibnkathir/073.bin', './data/ibnkathir/074.bin', './data/ibnkathir/075.bin', './data/ibnkathir/076.bin', './data/ibnkathir/077.bin', './data/ibnkathir/078.bin', './data/ibnkathir/079.bin', './data/ibnkathir/080.bin', './data/ibnkathir/081.bin', './data/ibnkathir/082.bin', './data/ibnkathir/083.bin', './data/ibnkathir/084.bin', './data/ibnkathir/085.bin', './data/ibnkathir/086.bin', './data/ibnkathir/087.bin', './data/ibnkathir/088.bin', './data/ibnkathir/089.bin', './data/ibnkathir/090.bin', './data/ibnkathir/091.bin', './data/ibnkathir/092.bin', './data/ibnkathir/093.bin', './data/ibnkathir/094.bin', './data/ibnkathir/095.bin', './data/ibnkathir/096.bin', './data/ibnkathir/097.bin', './data/ibnkathir/098.bin', './data/ibnkathir/099.bin', './data/ibnkathir/100.bin', './data/ibnkathir/101.bin', './data/ibnkathir/102.bin', './data/ibnkathir/103.bin', './data/ibnkathir/104.bin', './data/ibnkathir/105.bin', './data/ibnkathir/106.bin', './data/ibnkathir/107.bin', './data/ibnkathir/108.bin', './data/ibnkathir/109.bin', './data/ibnkathir/110.bin', './data/ibnkathir/111.bin', './data/ibnkathir/112.bin', './data/ibnkathir/113.bin', './data/ibnkathir/114.bin', './data/tabari/001.bin', './data/tabari/002.bin', './data/tabari/003.bin', './data/tabari/004.bin', './data/tabari/005.bin', './data/tabari/006.bin', './data/tabari/007.bin', './data/tabari/008.bin', './data/tabari/009.bin', './data/tabari/010.bin', './data/tabari/011.bin', './data/tabari/012.bin', './data/tabari/013.bin', './data/tabari/014.bin', './data/tabari/015.bin', './data/tabari/016.bin', './data/tabari/017.bin', './data/tabari/018.bin', './data/tabari/019.bin', './data/tabari/020.bin', './data/tabari/021.bin', './data/tabari/022.bin', './data/tabari/023.bin', './data/tabari/024.bin', './data/tabari/025.bin', './data/tabari/026.bin', './data/tabari/027.bin', './data/tabari/028.bin', './data/tabari/029.bin', './data/tabari/030.bin', './data/tabari/031.bin', './data/tabari/032.bin', './data/tabari/033.bin', './data/tabari/034.bin', './data/tabari/035.bin', './data/tabari/036.bin', './data/tabari/037.bin', './data/tabari/038.bin', './data/tabari/039.bin', './data/tabari/040.bin', './data/tabari/041.bin', './data/tabari/042.bin', './data/tabari/043.bin', './data/tabari/044.bin', './data/tabari/045.bin', './data/tabari/046.bin', './data/tabari/047.bin', './data/tabari/048.bin', './data/tabari/049.bin', './data/tabari/050.bin', './data/tabari/051.bin', './data/tabari/052.bin', './data/tabari/053.bin', './data/tabari/054.bin', './data/tabari/055.bin', './data/tabari/056.bin', './data/tabari/057.bin', './data/tabari/058.bin', './data/tabari/059.bin', './data/tabari/060.bin', './data/tabari/061.bin', './data/tabari/062.bin', './data/tabari/063.bin', './data/tabari/064.bin', './data/tabari/065.bin', './data/tabari/066.bin', './data/tabari/067.bin', './data/tabari/068.bin', './data/tabari/069.bin', './data/tabari/070.bin', './data/tabari/071.bin', './data/tabari/072.bin', './data/tabari/073.bin', './data/tabari/074.bin', './data/tabari/075.bin', './data/tabari/076.bin', './data/tabari/077.bin', './data/tabari/078.bin', './data/tabari/079.bin', './data/tabari/080.bin', './data/tabari/081.bin', './data/tabari/082.bin', './data/tabari/083.bin', './data/tabari/084.bin', './data/tabari/085.bin', './data/tabari/086.bin', './data/tabari/087.bin', './data/tabari/088.bin', './data/tabari/089.bin', './data/tabari/090.bin', './data/tabari/091.bin', './data/tabari/092.bin', './data/tabari/093.bin', './data/tabari/094.bin', './data/tabari/095.bin', './data/tabari/096.bin', './data/tabari/097.bin', './data/tabari/098.bin', './data/tabari/099.bin', './data/tabari/100.bin', './data/tabari/101.bin', './data/tabari/102.bin', './data/tabari/103.bin', './data/tabari/104.bin', './data/tabari/105.bin', './data/tabari/106.bin', './data/tabari/107.bin', './data/tabari/108.bin', './data/tabari/109.bin', './data/tabari/110.bin', './data/tabari/111.bin', './data/tabari/112.bin', './data/tabari/113.bin', './data/tabari/114.bin'];
const HASH = {"./":"7af34a69fe928424","./index.html":"7af34a69fe928424","./manifest.webmanifest":"475b53fa76459933","./icons/icon-192.png":"728c8889e3de4066","./icons/icon-512.png":"c5cf5404e6c3784d","./icons/maskable-512.png":"a6af2389265cbef2","./icons/apple-touch-icon.png":"89ab16f8423734d1","./icons/favicon-32.png":"a27175a5289cd70a","./data/ara-quranuthmanihaf.bin":"376c4040c05c1e8c","./data/eng-muftitaqiusmani.bin":"0939e5cf74bdeea6","./data/eng-ummmuhammad.bin":"816c25f193ce8803","./data/eng-abdullahyusufal.bin":"3615d4e2a6763f1d","./data/eng-mohammedmarmadu.bin":"63dbdf01f9cf3c1e","./data/fra-muhammadhamidul.bin":"90e9a2e8941fac8c","./data/deu-asfbubenheimand.bin":"7ad61acfae41c21a","./data/ara-quran-la.bin":"ceca8f5a7076f564","./data/ara-kingfahadquranc.bin":"7eb341194ecabbf3","./data/ara-quransimple.bin":"bd6057df80b4c452","./data/ara-saddi.bin":"590d63aa2ec830de","./data/lat-hafs.bin":"65894f0d5065dc85","./data/deu-aburida.bin":"0484abef403f4791","./data/deu-rwwad.bin":"a001424751bd7a7a","./data/eng-mukhtasar.bin":"6b8d367f546cfab9","./data/fra-mukhtasar.bin":"ce12d35d3b98b792","./data/spa-mukhtasar.bin":"7a0aac2934332483","./data/kur-mukhtasar.bin":"b6a6352a56b8d522","./data/kur-rebar.bin":"52ca20472c249646","./data/kmr-ismail.bin":"963dd85df2e33354","./data/spa-juliocortes.bin":"be5bf72e2d70312a","./data/spa-muhammadisagarc.bin":"05464ea881c6cbd7","./fonts/rb-serif.woff":"e926511b44ee0ada","./fonts/rb-naskh.woff":"2f7d5dc9ac4ba4b6","./data/wbw-en.bin":"aabe764722178912","./data/tajweed.bin":"d762a6c0422cbcd0","./data/roots.json":"b9ff44c50871e874","./data/ibnkathir/001.bin":"81e1ab61889a881f","./data/ibnkathir/002.bin":"a3022c4bf95690e2","./data/ibnkathir/003.bin":"ea9f6d863aba028c","./data/ibnkathir/004.bin":"a997e38712fe9cee","./data/ibnkathir/005.bin":"f5b8f00cf4d9ddff","./data/ibnkathir/006.bin":"3aba6102212d4365","./data/ibnkathir/007.bin":"f52e7c3135c5ee9d","./data/ibnkathir/008.bin":"e3292da0d2c81b2a","./data/ibnkathir/009.bin":"027b87d930709369","./data/ibnkathir/010.bin":"8161c5b636626a51","./data/ibnkathir/011.bin":"fa5f0453ac8e455b","./data/ibnkathir/012.bin":"c344a7f63856722f","./data/ibnkathir/013.bin":"599e36585ba9b437","./data/ibnkathir/014.bin":"1227d9c75ce05bf8","./data/ibnkathir/015.bin":"064da699b429a213","./data/ibnkathir/016.bin":"6d4e353517968ab6","./data/ibnkathir/017.bin":"0add08e32eb9ceb2","./data/ibnkathir/018.bin":"93ac51c55e7694ea","./data/ibnkathir/019.bin":"368ada00321c08a2","./data/ibnkathir/020.bin":"3ab50ea528319ece","./data/ibnkathir/021.bin":"0e99bc0fd11224bc","./data/ibnkathir/022.bin":"38ad1b65ece1b6fb","./data/ibnkathir/023.bin":"752ca705f1ae7c56","./data/ibnkathir/024.bin":"32d3867fe74e6ffe","./data/ibnkathir/025.bin":"f17ab8fe59d62327","./data/ibnkathir/026.bin":"3b8d03d393b75f70","./data/ibnkathir/027.bin":"7e6e4ae49939780f","./data/ibnkathir/028.bin":"f1be5c6fbdc05c57","./data/ibnkathir/029.bin":"4fd9eab76ff36518","./data/ibnkathir/030.bin":"220e2e434cd1da27","./data/ibnkathir/031.bin":"61f046335974aad9","./data/ibnkathir/032.bin":"f5df8df80616acbd","./data/ibnkathir/033.bin":"695bff4e1da39f56","./data/ibnkathir/034.bin":"820da7ad587e353b","./data/ibnkathir/035.bin":"93fde40cd6407a6b","./data/ibnkathir/036.bin":"14e3082723b24deb","./data/ibnkathir/037.bin":"aa08f494b51ea88a","./data/ibnkathir/038.bin":"2670066114463cd7","./data/ibnkathir/039.bin":"cf060da1a834e946","./data/ibnkathir/040.bin":"6abf2c086c460606","./data/ibnkathir/041.bin":"3abb55828f2b16cd","./data/ibnkathir/042.bin":"64fb4cbadf845aec","./data/ibnkathir/043.bin":"fa9d56c7d9498cf9","./data/ibnkathir/044.bin":"9827742ddf5e3de7","./data/ibnkathir/045.bin":"27b0af02babf95cc","./data/ibnkathir/046.bin":"c43c42d5957c9d1e","./data/ibnkathir/047.bin":"f516a1027a01ba3b","./data/ibnkathir/048.bin":"27a7a90547d20f23","./data/ibnkathir/049.bin":"acefcf723d7786bb","./data/ibnkathir/050.bin":"59e13765114b1c28","./data/ibnkathir/051.bin":"f19606655f5b0601","./data/ibnkathir/052.bin":"8731810941642d25","./data/ibnkathir/053.bin":"8b836706e29cc6e3","./data/ibnkathir/054.bin":"01616181dab87e88","./data/ibnkathir/055.bin":"d38f46dd7fe24766","./data/ibnkathir/056.bin":"2e0d0902f8b4f861","./data/ibnkathir/057.bin":"1e10e40580d43541","./data/ibnkathir/058.bin":"bce03acbf2d5adbd","./data/ibnkathir/059.bin":"f71dd4e8db34660e","./data/ibnkathir/060.bin":"addd61100cb10c91","./data/ibnkathir/061.bin":"08ee961fdb5e204a","./data/ibnkathir/062.bin":"bd51225abc4847ba","./data/ibnkathir/063.bin":"beeb6c2e692995ab","./data/ibnkathir/064.bin":"63f3efc8e504c2e1","./data/ibnkathir/065.bin":"8b6e7083edb3f022","./data/ibnkathir/066.bin":"1e2c1b862cc2310b","./data/ibnkathir/067.bin":"035a9c48d0a6bfd9","./data/ibnkathir/068.bin":"f2cc87541b75cc1f","./data/ibnkathir/069.bin":"6c837a93d69e7f17","./data/ibnkathir/070.bin":"f948be3b66c410af","./data/ibnkathir/071.bin":"352a1dbcfd503b37","./data/ibnkathir/072.bin":"3d320318f3d1a445","./data/ibnkathir/073.bin":"6b347a9fc19fe3e3","./data/ibnkathir/074.bin":"9ae9eef0667a73a3","./data/ibnkathir/075.bin":"429bf69696f33f69","./data/ibnkathir/076.bin":"dda89937479fbb33","./data/ibnkathir/077.bin":"fbaac66187fc5dfd","./data/ibnkathir/078.bin":"12c5eba6a0db05c9","./data/ibnkathir/079.bin":"e0d2503ce3193b94","./data/ibnkathir/080.bin":"c5058e6781515a53","./data/ibnkathir/081.bin":"2e9dcae8675d8b3b","./data/ibnkathir/082.bin":"02da04dfd68db4eb","./data/ibnkathir/083.bin":"dd4349c58eb9e79c","./data/ibnkathir/084.bin":"8e1bcb8a8910c3ee","./data/ibnkathir/085.bin":"fd4f3d0b6aa9004e","./data/ibnkathir/086.bin":"60300f152626b548","./data/ibnkathir/087.bin":"d4fce07854b7e538","./data/ibnkathir/088.bin":"dc1eac5718e19013","./data/ibnkathir/089.bin":"acdf1542bb43f5bf","./data/ibnkathir/090.bin":"5617b559c795c03e","./data/ibnkathir/091.bin":"f2e1305634107fd5","./data/ibnkathir/092.bin":"b2991eb10c2cda58","./data/ibnkathir/093.bin":"33940e0d1aa20987","./data/ibnkathir/094.bin":"7b6d61543e1ed22a","./data/ibnkathir/095.bin":"fe104d5a9fcff971","./data/ibnkathir/096.bin":"c48212d0783df484","./data/ibnkathir/097.bin":"8b2dd1b4b0dacde3","./data/ibnkathir/098.bin":"519db2ee36c01a5f","./data/ibnkathir/099.bin":"e0391c2c44df1044","./data/ibnkathir/100.bin":"bc7575a7d7f54f2d","./data/ibnkathir/101.bin":"90fa51a71ad0ddbb","./data/ibnkathir/102.bin":"a057c6b63abc1f63","./data/ibnkathir/103.bin":"a4a11c7964897c38","./data/ibnkathir/104.bin":"e59fb8a44d305fb1","./data/ibnkathir/105.bin":"012216fbba550015","./data/ibnkathir/106.bin":"de36f83cd19c80ed","./data/ibnkathir/107.bin":"984d30899776eec1","./data/ibnkathir/108.bin":"a53a2215e9387336","./data/ibnkathir/109.bin":"6d4bc85b1ec5a60d","./data/ibnkathir/110.bin":"a8d9fd10f5f41534","./data/ibnkathir/111.bin":"7f87310cb68e6f7f","./data/ibnkathir/112.bin":"abcc8981e6d60042","./data/ibnkathir/113.bin":"c82a7b330c6bf040","./data/ibnkathir/114.bin":"17e9cb122e0bb9e8","./data/tabari/001.bin":"adf9b540883ae61d","./data/tabari/002.bin":"1ff2ada17243785f","./data/tabari/003.bin":"0e1b6e755c6f6685","./data/tabari/004.bin":"a29810a8cc84b179","./data/tabari/005.bin":"9a98a8314d62d478","./data/tabari/006.bin":"9ad0b3bbc1675f4e","./data/tabari/007.bin":"44b4b9894b815c59","./data/tabari/008.bin":"cf35a90521e9a81e","./data/tabari/009.bin":"4234296770989210","./data/tabari/010.bin":"d02ad114a0309438","./data/tabari/011.bin":"15ec56ece5bba683","./data/tabari/012.bin":"4162c1f2c85d8fe5","./data/tabari/013.bin":"d47762710f228009","./data/tabari/014.bin":"598eabf296da17f9","./data/tabari/015.bin":"f60d0b740d730c30","./data/tabari/016.bin":"9d3f3659b42206b9","./data/tabari/017.bin":"95ec7f609e02d6e3","./data/tabari/018.bin":"598158a11e88a4f5","./data/tabari/019.bin":"c0c3d2fdcf5f1de6","./data/tabari/020.bin":"01657e0b0efe6e0e","./data/tabari/021.bin":"0043917676ca54d5","./data/tabari/022.bin":"16c69a5de0c657f6","./data/tabari/023.bin":"22fa6134a8211791","./data/tabari/024.bin":"df3a3e86c358b2be","./data/tabari/025.bin":"60dc1578cad6b64d","./data/tabari/026.bin":"62046c656add6c00","./data/tabari/027.bin":"80d2f2e10f631756","./data/tabari/028.bin":"1822eea4848a3c2b","./data/tabari/029.bin":"4d40c257da98c015","./data/tabari/030.bin":"fc9545e0009bddf4","./data/tabari/031.bin":"56af56e64ea55c28","./data/tabari/032.bin":"59b6f30aa29f5073","./data/tabari/033.bin":"ccbc6b41291f7e89","./data/tabari/034.bin":"442d2d15736964b6","./data/tabari/035.bin":"d056241e1c0aac76","./data/tabari/036.bin":"11ff1349830c50f3","./data/tabari/037.bin":"add407b26bbbb007","./data/tabari/038.bin":"227d482cb2a80193","./data/tabari/039.bin":"62549d295a1bc294","./data/tabari/040.bin":"8ee356fbe987d3a0","./data/tabari/041.bin":"bcb48c4c439148cf","./data/tabari/042.bin":"db1edf2d98a8c8b4","./data/tabari/043.bin":"ae247d086cf9179a","./data/tabari/044.bin":"64cbb85143a2e3da","./data/tabari/045.bin":"ae0f987f123bce9e","./data/tabari/046.bin":"a19e3480d35472aa","./data/tabari/047.bin":"443631d9e64755ab","./data/tabari/048.bin":"50e02a176fdc640f","./data/tabari/049.bin":"e6a2d0a46ecbd7f0","./data/tabari/050.bin":"048688029b1729bd","./data/tabari/051.bin":"31a7d8e7bea657d9","./data/tabari/052.bin":"30397a0dcc3fd8c1","./data/tabari/053.bin":"564ab6ab6c09cdce","./data/tabari/054.bin":"32063bcb35f9040b","./data/tabari/055.bin":"22c64a360267b0e6","./data/tabari/056.bin":"8869c883b69dca45","./data/tabari/057.bin":"88c47fa7b0d0757e","./data/tabari/058.bin":"393db3e06bd76c61","./data/tabari/059.bin":"e72c9caa09b88a28","./data/tabari/060.bin":"c07acd26cdc2bee0","./data/tabari/061.bin":"e6de44cf3176d4a5","./data/tabari/062.bin":"5d3ef5370ac5d745","./data/tabari/063.bin":"3082958d263b7ee3","./data/tabari/064.bin":"cb07abb9cb2d0f65","./data/tabari/065.bin":"62857efe70e90456","./data/tabari/066.bin":"e53f20d6b7e93340","./data/tabari/067.bin":"1420b9256b66c3e1","./data/tabari/068.bin":"4e132287247b9496","./data/tabari/069.bin":"94fb00a7293dd0f1","./data/tabari/070.bin":"7a877952b700933f","./data/tabari/071.bin":"671b100671e1b6da","./data/tabari/072.bin":"31278f2c367c3dbb","./data/tabari/073.bin":"7122f0bde7b62240","./data/tabari/074.bin":"2fa2574958370b68","./data/tabari/075.bin":"b7fdf0625bba83d7","./data/tabari/076.bin":"ec57387a3ccf0b45","./data/tabari/077.bin":"efc12955e0d10549","./data/tabari/078.bin":"f97b8dd514cd2c67","./data/tabari/079.bin":"c79a852cd45ca881","./data/tabari/080.bin":"5affb0667eb2a3c0","./data/tabari/081.bin":"ee329a1005eb89e5","./data/tabari/082.bin":"4cc2e7a7c56b1589","./data/tabari/083.bin":"35e4b2af1327c258","./data/tabari/084.bin":"fcc335154feb2b79","./data/tabari/085.bin":"9b7a2a909f164326","./data/tabari/086.bin":"aec4ebc515dfe689","./data/tabari/087.bin":"ffb40614048e005b","./data/tabari/088.bin":"0cab79f7069bb15a","./data/tabari/089.bin":"496942e48595e40f","./data/tabari/090.bin":"d6a09279e1507cbb","./data/tabari/091.bin":"b84823d296b3d908","./data/tabari/092.bin":"ed41f5a054fbb67d","./data/tabari/093.bin":"7d29ab50d201ac9b","./data/tabari/094.bin":"54e7069c70fa1b6d","./data/tabari/095.bin":"8a75d5b7beb5708d","./data/tabari/096.bin":"bd8ec4591befe3b5","./data/tabari/097.bin":"acdfa49a8778035f","./data/tabari/098.bin":"363f39dcb395adc9","./data/tabari/099.bin":"e8049b810de9df23","./data/tabari/100.bin":"906200a0bb2e157c","./data/tabari/101.bin":"71b9dad7b308ccd7","./data/tabari/102.bin":"654004a0428ec69e","./data/tabari/103.bin":"e79477923625aef0","./data/tabari/104.bin":"c29393094590788a","./data/tabari/105.bin":"3300454cde64c28d","./data/tabari/106.bin":"2c8398493448e0b6","./data/tabari/107.bin":"3dac8d9f3772d028","./data/tabari/108.bin":"c9e082687d4f34d5","./data/tabari/109.bin":"d22594f1763ab77d","./data/tabari/110.bin":"1a2badecbf4043cf","./data/tabari/111.bin":"e8b90bb22ddf7d7f","./data/tabari/112.bin":"ce93017857dc274a","./data/tabari/113.bin":"8f299b7919e2b4a3","./data/tabari/114.bin":"636e188631f38b28"};
const abs = u => new URL(u, self.registration.scope).href;
const INDEX = () => abs('./index.html');

async function tell(msg) { for (const c of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) c.postMessage(msg); }
let saving = null;
async function fingerprint(res) {
  const d = await crypto.subtle.digest('SHA-256', await res.clone().arrayBuffer());
  return [...new Uint8Array(d)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join('');
}
/* Copy every file that did not change from the previous offline copy (no internet used).
   Each offline copy keeps the fingerprints it was built from (./__files__), so unchanged files are recognised
   without re-reading them; older copies without that record are checked by hashing. */
const RECORD = './__files__';
async function reuseOld(c) {
  const olds = [];
  for (const k of await caches.keys()) if (k.startsWith('alquran-') && k !== CACHE && k !== RUNTIME) {
    const o = await caches.open(k); let rec = null;
    try { const r = await o.match(abs(RECORD)); rec = r ? await r.json() : null; } catch (e) {}
    olds.push([o, rec]);
  }
  if (!olds.length) return 0;
  let n = 0;
  for (const u of SHELL) {
    const url = abs(u), want = HASH[u];
    if (!want || await c.match(url)) continue;
    for (const [o, rec] of olds) {
      if (rec && rec[u] !== want) continue;
      const r = await o.match(url);
      if (r && r.ok && (rec ? true : await fingerprint(r).catch(() => '') === want)) { await c.put(url, r); n++; break; }
    }
  }
  return n;
}
function precache() {
  if (saving) return saving;
  saving = (async () => {
    const c = await caches.open(CACHE);
    try { await reuseOld(c); } catch (e) {}
    const need = [];
    for (const u of SHELL) if (!(await c.match(abs(u)))) need.push(u);
    /* an update or a small repair (a few files) is silent; only a first full save reports progress */
    const quiet = need.length <= 6, say = m => quiet ? null : tell(m);
    /* files with the same content (./ and ./index.html) are downloaded once */
    const lead = {}, prim = [], dup = [];
    for (const u of need) { const h = HASH[u]; if (h && lead[h]) dup.push([u, lead[h]]); else { if (h) lead[h] = u; prim.push(u); } }
    let done = 0, fail = null;
    const one = async u => {
      const url = abs(u);
      let twin = null; // same content already saved under another name
      if (HASH[u]) for (const v of SHELL) if (v !== u && HASH[v] === HASH[u] && (twin = await c.match(abs(v)))) break;
      if (twin) { await c.put(url, twin); return; }
      let ok = false, err = '';
      /* ask for this exact content (?v=fingerprint) so a stale copy on GitHub's servers can't be served; check it, retry once if it's old */
      for (let i = 0; i < 4 && !ok; i++) {
        try {
          const q = url + (url.includes('?') ? '&' : '?') + 'v=' + (HASH[u] || BUILD) + (i ? '&t=' + Date.now() : '');
          const r = await fetch(new Request(q, { cache: 'reload' }));
          if (r.ok && !r.redirected) {
            if (HASH[u] && i < 2 && await fingerprint(r).catch(() => '') !== HASH[u]) { err = 'old copy'; continue; }
            await c.put(url, r); ok = true;
          } else err = 'HTTP ' + r.status;
        }
        catch (e) { err = e.message; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
      }
      if (!ok) throw new Error(u + ': ' + err);
    };
    /* six downloads at a time: a first save of all files takes a fraction of the time */
    const queue = prim.slice();
    await Promise.all(Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (queue.length && !fail) {
        const u = queue.shift();
        try { await one(u); done++; await say({ type: 'offline-progress', done, total: need.length }); } catch (e) { fail = fail || e; }
      }
    }));
    if (fail) { await say({ type: 'offline-progress', done, total: need.length, error: fail.message }); throw new Error('Could not save ' + fail.message); }
    for (const [u, src] of dup) { const r = await c.match(abs(src)); if (r) await c.put(abs(u), r); done++; }
    try { await c.put(abs(RECORD), new Response(JSON.stringify(HASH), { headers: { 'Content-Type': 'application/json' } })); } catch (e) {}
    await tell({ type: 'offline-ready', build: BUILD, total: SHELL.length, downloaded: need.length });
    return done;
  })().finally(() => { saving = null; });
  return saving;
}
async function status() {
  const c = await caches.open(CACHE); let n = 0;
  for (const u of SHELL) if (await c.match(abs(u))) n++;
  return { type: 'offline-status', build: BUILD, cached: n, total: SHELL.length };
}

self.addEventListener('install', e => { e.waitUntil(precache()); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const st = await status();
    if (st.cached === st.total) for (const k of await caches.keys()) if (k.startsWith('alquran-') && k !== CACHE && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => {
  const d = e.data;
  if (d === 'skipWaiting') self.skipWaiting();
  if (d === 'ensure') e.waitUntil(precache().catch(() => {}));
  if (d === 'status') e.waitUntil(status().then(s => e.source && e.source.postMessage(s)));
});

async function cachedPage() {
  const own = await caches.open(CACHE);
  return (await own.match(INDEX())) || (await own.match(abs('./'))) || (await caches.match(INDEX(), { ignoreSearch: true })) || (await caches.match(abs('./'), { ignoreSearch: true }));
}
const OFFLINE_HTML = `<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlQuran</title>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0b3527;color:#f3ead0;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><div style="font-size:42px">📖</div><h2 style="margin:8px 0">AlQuran isn't saved on this phone yet</h2>
<p style="opacity:.85;line-height:1.5">Connect to the internet once and open AlQuran.<br>Keep it open until you see <b>“Works offline ✓”</b>.<br>After that it works without internet.</p>
<button onclick="location.reload()" style="margin-top:12px;padding:12px 20px;border-radius:12px;border:0;background:#d8b56a;color:#0b3527;font-weight:700;font-size:16px">Try again</button></div></body>`;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const hit = await cachedPage();
      if (hit) return hit;
      try { const r = await fetch(req); return r; }
      catch (err) { return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }); }
    })());
    return;
  }
  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.json')) return;   /* always from the network */
    e.respondWith((async () => {
      const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match(url.origin + url.pathname, { ignoreSearch: true }));
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); c.put(url.origin + url.pathname, res.clone()); }
      return res;
    })());
    return;
  }
  if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME), hit = await c.match(req);
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit || new Response('', { status: 504 }));
      return hit || net;
    })());
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { c.postMessage({ type: 'open', link }); return c.focus(); }
    return self.clients.openWindow('./#' + (link.split(':')[0] || 'home'));
  })());
});
