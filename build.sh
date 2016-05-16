builddir=/home/hayashis/tmp
pubdir=/home/hayashis/Dropbox/Public/kdinstall

#electron-packager . --overwrite --platform=linux --arch=x64 --out=$builddir
#(cd $builddir && tar -cz kdinstall-linux-x64 > $pubdir/kdinstall-linux-x64.tar.gz)

electron-packager . --overwrite --platform=win32 --arch=x64 --out=$builddir
(cd $builddir && zip -r $pubdir/kdinstall-win32-x64.zip kdinstall-win32-x64)
