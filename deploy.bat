@echo off
echo Deploying to production...

rem Try multiple push strategies
echo Attempting standard push...
git push origin master
if %errorlevel% equ 0 goto success

echo Standard push failed, trying force push...
git push -f origin master
if %errorlevel% equ 0 goto success

echo Force push failed, trying with timeout...
timeout /t 5 /nobreak
git push origin master
if %errorlevel% equ 0 goto success

echo All push attempts failed. Please check your network connection.
goto end

:success
echo Deployment successful!

:end
pause