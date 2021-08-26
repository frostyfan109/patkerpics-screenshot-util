import { createStore, applyMiddleware, compose } from 'redux';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import thunk from 'redux-thunk';
import rootReducer from './reducers';
import { pageLoad } from './actions';

// const persistConfig = {
//     key: 'Patkerpics-persist-state',
//     storage: storage,
//     whitelist: [
//     ]
// };

// const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = createStore(
    rootReducer,
    compose(
        applyMiddleware(thunk)
        // (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__()
    )
);

store.dispatch<any>(pageLoad());

// export const persistor = persistStore(store);