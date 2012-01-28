#!/usr/bin/env bash

[[ -d build ]] && rm -r build
mkdir build || exit 1

. PKGBUILD.src

cd webfiles
tar -czf ../build/webfiles.tar.gz *
cd ..

cp src/* build
cp iptvrec.install build/
cp PKGBUILD.src build/PKGBUILD

cd build

echo "md5sums=(" >> PKGBUILD
for FN in "${source[@]}"; do
    echo \'$(md5sum "$FN" | cut -f 1 -d ' ')\' >> PKGBUILD
done
echo ")" >> PKGBUILD

makepkg -f
makepkg -f --source

