:: as����תts�ű�
:: @teppei, 2016/9/30

@echo off
setlocal enabledelayedexpansion

title as����תts@teppei

type readme.txt

set launcher_srcPath="E:\qhgame\trunk\project\src"
set lauucher_outPath="E:\qhgame\tsproj\src"

perl as2ts.pl %launcher_srcPath% %lauucher_outPath%

: END
endlocal enabledelayedexpansion
@pause