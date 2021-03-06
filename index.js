var _ = require('lodash');
var Q = require('q');
var markdown = require('markdown').markdown;
var fs = require('fs');
var path = require('path');
var toRead = ['description.md', 'title.txt', 'recipe.json'];
var BRANCH = process.env.RECIPES_BRANCH || 'master';
var GIT_CONTENT_PATH = 'https://raw.githubusercontent.com/elasticio/recipes/';
var cache;

exports.connect = connect;
exports.platform = platform;
exports.all = all;

function platform() {
    return all().then(filterPlatform).then(transformToRecipe);

    function filterPlatform(recipes) {
        return recipes.filter(filter);
        function filter(recipe) {
            return !~recipe.plan.indexOf('connect');
        }
    }

    function transformToRecipe(recipes) {
        return recipes.map(transform);
        function transform(recipe) {
            recipe.recipes[0].pricingPlan = recipe.plan;
            recipe.recipes[0].id = recipe._id;
            return recipe.recipes[0];
        }
    }
}

function connect() {
    return all().then(filterConnect);

    function filterConnect(recipes) {
        return recipes.filter(filter);
        function filter(recipe) {
            return ~recipe.plan.indexOf('connect');
        }
    }
}

function all() {
    if (cache) {
        return Q(cache);
    } else {
        return readAll();
    }
}

function readAll() {
    return Q.nfcall(fs.readdir, __dirname)
        .then(processDir)
        .then(cacheResult);
}

function cacheResult(result) {
    cache = result;
    return cache;
}

function tagsFilter(filename) {
    return !filename.indexOf('.tag_');
}

function iconsFilter(filename) {
    return !filename.indexOf('icon_');
}

function iconsMap(filename) {
    var title = filename
        .replace('icon_', '')
        .replace('.png', '');

    return [title, filename];
}

function tagsMap(filename) {
    return filename.replace('.tag_', '');
}

function filterPlan(filename) {
    return !filename.indexOf('.plan_');
}

function processDir(files) {
    var promises = [];

    files.forEach(getRecipe);

    function getRecipe(recipeId) {
        if (!~recipeId.indexOf('.') && recipeId !== 'node_modules') {

            promises.push(
                Q.all(
                    toRead.map(readFile)
                        .concat(Q.nfcall(fs.readdir, path.join(__dirname, recipeId)))
                )
                    .then(prepareRecipe)
            );

            function readFile(fileName) {
                return Q.nfcall(
                    fs.readFile,
                    path.join(__dirname, recipeId, fileName),
                    'utf8'
                );
            }

            function prepareRecipe(datas) {
                var files = datas[3];
                var desc = markdown.toHTML(datas[0]);
                var title = datas[1];
                var tags = files.filter(tagsFilter).map(tagsMap);
                var plan = _.find(files, filterPlan);
                var images = {};

                files
                    .filter(iconsFilter)
                    .map(iconsMap)
                    .forEach(addImage);

                if (plan) {
                    plan = plan.replace('.plan_', '');
                }

                function addImage(pair) {
                    images[pair[0]] = GIT_CONTENT_PATH + path.join(BRANCH, recipeId, pair[1]);
                }

                return _.extend({
                    _id: recipeId,
                    description: desc,
                    title: title,
                    plan: plan,
                    images: images,
                    tags: tags
                }, JSON.parse(datas[2]));
            }
        }
    }
    return Q.all(promises);
}
