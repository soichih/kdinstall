builddir=/home/hayashis/tmp
pubdir=/home/hayashis/Dropbox/Public/kdinstall

#clean up old stuff
rm -rf $builddir/*

#electron-packager . --overwrite --version=1.0.1 --platform=linux --arch=x64 --out=$builddir
#(cd $builddir && tar -cz kdinstall-linux-x64 > $pubdir/kdinstall-linux-x64.tar.gz)

electron-packager . --overwrite --version=1.0.2 --platform=win32 --arch=x64 --out=$builddir
(cd $builddir && zip -r $pubdir/kdinstall-win32-x64.zip kdinstall-win32-x64)

#electron-packager . --overwrite --version=1.1.0 --platform=darwin --arch=x64 --out=$builddir
#(cd $builddir && tar -cz kdinstall-darwin-x64 > $pubdir/kdinstall-darwin-x64.tar.gz)
