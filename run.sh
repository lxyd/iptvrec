./build.sh

sudo /etc/rc.d/iptvrec stop

sudo rm /var/log/iptvrec/out
sudo rm /var/log/iptvrec/err

yes | sudo pacman -U "iptvrec-0.1-1-any.pkg.tar.xz"

sudo /etc/rc.d/iptvrec start

echo "################# OUTPUT SO FAR ####################"
cat /var/log/iptvrec/out
echo "################# ERRORS SO FAR ####################"
cat /var/log/iptvrec/err
