
npm install

npm run build

cp tsconfig.json dist/
cp tsconfig.app.json dist/
cp tsconfig.node.json dist/

chmod +x render-build.sh

echo "Build completed successfully!"
