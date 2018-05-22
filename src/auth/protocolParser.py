# -*- coding: utf-8 -*-
"""
Created on Sat Aug  5 08:41:38 2017

@author: Jeremy
"""

import sys,imp, json
protoSource = sys.argv[1]

prot = imp.new_module('newProtocol')
exec(protoSource[protoSource.index('typeinfos'):], prot.__dict__)
protStuff = {'hID':prot.replay_header_typeid,'dID':prot.game_details_typeid,'iID':prot.replay_initdata_typeid,
            'tID':prot.tracker_eventid_typeid,'typeInfos': prot.typeinfos,
            'tTypes':prot.tracker_event_types,'mTypes':prot.message_event_types }

print(json.dumps(protStuff))
sys.stdout.flush()
