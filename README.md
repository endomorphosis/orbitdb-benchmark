# Summary

Demo for using [orbitdb](https://github.com/orbitdb/orbitdb).

# Run

Node 1:
~~~shell
node orbitv3-master.js --ipAddress=127.0.0.1
~~~

Copy the db address.

Node 2:

~~~shell
node orbitv3-slave.js --ipAddress=127.0.0.1 --dbAddress=/orbitdb/zdpuB31L6gJz49erikZSQT3A1erJbid8oUTBrjLtBwjjXe3R5
~~~

Test websockets 

~~~shell
node websocket-test-master.js
~~~

~~~shell
node websocket-test-slave.js
~~~

Import collection.json

~~~shell
node import-collection.js
~~~


insert 32k master
first message recieved
Time to first message recieved: 
60.609
All messages recieved
Time to final message recieved: 
91.28
