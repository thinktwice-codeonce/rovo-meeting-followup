# development document

* create app in the site with development environment
* make changes and deploy if having small version update. else, run `forge install --upgrade` to install the new version
* create tunnel to test the running app

## commands

* create app
```sh
forge create <app-name>
```

* create new development environment to avoid conflict
```sh
forge environments create # then enter the name of the env -> Enter
```

* deploy and install the app on the target site
```sh
forge deploy --environment <env-name> --verbose
forge variables set --environment <env-name> --encrypt <key-name> <key-value>
forge install --site <site-name>.atlassian.net --product <product-name> --non-interactive -e <env-name>
```

* during development phase
```sh
forge deploy -e <env-name>  # deploy changes to the site
```

or 
```sh
forge tunnel --debug --debugFunctionHandlers index.<function> --debugStartingPort <port> -e <env-name> # hotload changes
```

* if manifest.yml is updated, you have to run `forge deploy` to apply changes before `forge tunnel`
* if there's major version update, run `forge install --upgrade` instead.

## env variables in forge tunnel

When you're using the `forge tunnel` command, you must prefix environment variables with `FORGE_USER_VAR_`, as the `forge tunnel` is fowarding the agent to run locally.

Set the value of `MY_KEY` by prefixing `FORGE_USER_VAR_` to the variable name, then running the following command in your terminal:

```sh
export FORGE_USER_VAR_MY_KEY=test
```

You do not need to change variable assignment when using environment variables with forge tunnel, the variable is still accessed with `MY_KEY`.

```sh
const myVar = process.env.MY_KEY // MY_KEY==test
```

Any changes while scripting will be directly reflected while running `forge tunnel`. Quite helpful for debugging.